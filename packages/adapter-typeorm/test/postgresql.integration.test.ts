import { TenancyManager, TenantContextError } from "@tenancyjs/core";
import knex, { type Knex } from "knex";
import { DataSource, EntitySchema } from "typeorm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  TypeOrmEntityUnregisteredError,
  TypeOrmPolicyValidationError,
  TypeOrmTenantFieldConflictError,
  TypeOrmUnsafeCriteriaError,
  createTypeOrmTenancy,
} from "../src/index.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describePostgres =
  databaseUrl === undefined ? describe.skip : describe.sequential;
const suffix = `${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
const schema = `typeorm_rls_${suffix}`;
const runtimeRole = `typeorm_runtime_${suffix}`;

interface Tenant {
  readonly id: string;
}

interface Post {
  id: string;
  tenantId: string;
  title: string;
}

const PostEntity = new EntitySchema<Post>({
  name: "Post",
  tableName: "posts",
  schema,
  columns: {
    id: { type: String, primary: true },
    tenantId: { type: String, name: "tenant_id", primary: true },
    title: { type: String },
  },
});

describePostgres("TypeORM PostgreSQL row-level isolation", () => {
  let admin: Knex;
  let dataSource: DataSource;
  let manager: TenancyManager<Tenant>;
  let tenancy: ReturnType<typeof createTypeOrmTenancy<Tenant>>;

  beforeAll(async () => {
    admin = knex({ client: "pg", connection: databaseUrl! });
    await admin.schema.createSchema(schema);
    await admin.schema.withSchema(schema).createTable("posts", (table) => {
      table.string("id").notNullable();
      table.string("tenant_id").notNullable();
      table.string("title").notNullable();
      table.primary(["id", "tenant_id"]);
    });
    await admin.raw(`alter table ${schema}.posts enable row level security`);
    await admin.raw(`alter table ${schema}.posts force row level security`);
    await admin.raw(`
      create policy posts_tenant_isolation on ${schema}.posts
      using (
        current_setting('tenancyjs.is_central', true) = 'true'
        or tenant_id = nullif(current_setting('tenancyjs.tenant_id', true), '')
      )
      with check (
        current_setting('tenancyjs.is_central', true) = 'true'
        or tenant_id = nullif(current_setting('tenancyjs.tenant_id', true), '')
      )
    `);
    await admin.raw(`create role ${runtimeRole} login nosuperuser nobypassrls`);
    await admin.raw(`grant usage on schema ${schema} to ${runtimeRole}`);
    await admin.raw(
      `grant select, insert, update, delete on ${schema}.posts to ${runtimeRole}`,
    );

    const runtimeUrl = new URL(databaseUrl!);
    runtimeUrl.username = runtimeRole;
    runtimeUrl.password = "";
    dataSource = new DataSource({
      type: "postgres",
      url: runtimeUrl.toString(),
      entities: [PostEntity],
      synchronize: false,
    });
    await dataSource.initialize();
    manager = new TenancyManager<Tenant>();
    tenancy = createTypeOrmTenancy({
      manager,
      dataSource,
      tenantEntities: [
        {
          entity: PostEntity,
          table: `${schema}.posts`,
          tenantProperty: "tenantId",
          tenantColumn: "tenant_id",
        },
      ],
    });
  });

  beforeEach(async () => {
    await admin.withSchema(schema).table("posts").delete();
    await expect(tenancy.validate()).resolves.toEqual({
      valid: true,
      issues: [],
    });
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    if (admin !== undefined) {
      await admin.schema.dropSchemaIfExists(schema, true);
      await admin.raw(`drop role if exists ${runtimeRole}`);
      await admin.destroy();
    }
  });

  const tenantA: Tenant = { id: "tenant-a" };
  const tenantB: Tenant = { id: "tenant-b" };

  function run<TResult>(
    tenant: Tenant,
    callback: Parameters<typeof tenancy.run<TResult>>[0],
  ): Promise<TResult> {
    return manager.runWithTenant(tenant, () => tenancy.run(callback));
  }

  it("isolates colliding ids across supported CRUD and count operations", async () => {
    await run(tenantA, (client) =>
      client.repository(PostEntity).create({ id: "same-id", title: "A" }),
    );
    await run(tenantB, (client) =>
      client.repository(PostEntity).create({ id: "same-id", title: "B" }),
    );

    await expect(
      run(tenantA, (client) => client.repository(PostEntity).findBy()),
    ).resolves.toEqual([{ id: "same-id", tenantId: "tenant-a", title: "A" }]);
    await expect(
      run(tenantB, (client) => client.repository(PostEntity).countBy()),
    ).resolves.toBe(1);
    await expect(
      run(tenantA, (client) =>
        client
          .repository(PostEntity)
          .update({ id: "same-id" }, { title: "A2" }),
      ),
    ).resolves.toBe(1);
    await expect(
      run(tenantB, (client) =>
        client.repository(PostEntity).findOneBy({ id: "same-id" }),
      ),
    ).resolves.toMatchObject({ title: "B" });
    await expect(
      run(tenantA, (client) =>
        client.repository(PostEntity).delete({ id: "same-id" }),
      ),
    ).resolves.toBe(1);
    await expect(
      run(tenantB, (client) => client.repository(PostEntity).countBy()),
    ).resolves.toBe(1);
  });

  it("fails closed on missing validation/context, conflicts, unsafe criteria, and unknown entities", async () => {
    const locked = createTypeOrmTenancy({
      manager,
      dataSource,
      tenantEntities: [{ entity: PostEntity, table: `${schema}.posts` }],
    });
    await expect(
      manager.runWithTenant(tenantA, () => locked.run(async () => undefined)),
    ).rejects.toBeInstanceOf(TypeOrmPolicyValidationError);
    await expect(tenancy.run(async () => undefined)).rejects.toBeInstanceOf(
      TenantContextError,
    );
    await expect(
      run(tenantA, (client) =>
        client.repository(PostEntity).create({
          id: "bad",
          tenantId: "tenant-b",
          title: "bad",
        }),
      ),
    ).rejects.toBeInstanceOf(TypeOrmTenantFieldConflictError);
    await expect(
      run(tenantA, (client) =>
        client.repository(PostEntity).findBy({ id: { raw: true } } as never),
      ),
    ).rejects.toBeInstanceOf(TypeOrmUnsafeCriteriaError);
    await expect(
      run(tenantA, (client) =>
        client.repository(new EntitySchema({ name: "Unknown", columns: {} })),
      ),
    ).rejects.toBeInstanceOf(TypeOrmEntityUnregisteredError);
  });

  it("rolls back callback failures and leaves no tenant state on pooled reuse", async () => {
    const failure = new Error("rollback");
    await expect(
      run(tenantA, async (client) => {
        await client
          .repository(PostEntity)
          .create({ id: "rolled-back", title: "A" });
        throw failure;
      }),
    ).rejects.toBe(failure);
    await expect(
      run(tenantA, (client) => client.repository(PostEntity).countBy()),
    ).resolves.toBe(0);
    await expect(dataSource.getRepository(PostEntity).find()).resolves.toEqual(
      [],
    );
  });
});
