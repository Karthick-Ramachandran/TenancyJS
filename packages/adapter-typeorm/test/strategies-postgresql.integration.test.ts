import { TenancyManager } from "tenancyjs-core";
import knex, { type Knex } from "knex";
import { DataSource, EntitySchema } from "typeorm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTypeOrmTenancy } from "../src/index.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describePostgres = databaseUrl === undefined ? describe.skip : describe;
const suffix = `${process.pid}_${Math.random().toString(36).slice(2, 8)}`;

interface Tenant {
  readonly id: string;
  readonly schema: string;
  readonly database: string;
}

interface Post {
  id: string;
  title: string;
}

const PostEntity = new EntitySchema<Post>({
  name: `StrategyPost_${suffix}`,
  tableName: "posts",
  columns: {
    id: { type: String, primary: true },
    title: { type: String },
  },
});

function databaseUrlFor(database: string): string {
  const url = new URL(databaseUrl!);
  url.pathname = `/${database}`;
  return url.toString();
}

async function createDataSource(url: string): Promise<DataSource> {
  return new DataSource({
    type: "postgres",
    url,
    entities: [PostEntity],
    synchronize: false,
  }).initialize();
}

describePostgres("TypeORM PostgreSQL schema-per-tenant isolation", () => {
  const schemaA = `typeorm_spt_a_${suffix}`;
  const schemaB = `typeorm_spt_b_${suffix}`;
  const centralSchema = `typeorm_spt_c_${suffix}`;
  const runtimeRole = `typeorm_spt_runtime_${suffix}`;
  const manager = new TenancyManager<Tenant>();
  let admin: Knex;
  let dataSource: DataSource;
  let tenancy: ReturnType<typeof createTypeOrmTenancy<Tenant>>;

  beforeAll(async () => {
    admin = knex({ client: "pg", connection: databaseUrl! });
    for (const schema of [schemaA, schemaB, centralSchema]) {
      await admin.schema.createSchema(schema);
    }
    for (const schema of [schemaA, schemaB]) {
      await admin.schema.withSchema(schema).createTable("posts", (table) => {
        table.text("id").primary();
        table.text("title").notNullable();
      });
    }
    await admin.raw(`create role ${runtimeRole} login nosuperuser nobypassrls`);
    await admin.raw(
      `grant usage on schema ${schemaA}, ${schemaB}, ${centralSchema} to ${runtimeRole}`,
    );
    await admin.raw(
      `grant select, insert, update, delete on ${schemaA}.posts, ${schemaB}.posts to ${runtimeRole}`,
    );
    const runtimeUrl = new URL(databaseUrl!);
    runtimeUrl.username = runtimeRole;
    runtimeUrl.password = "";
    dataSource = await createDataSource(runtimeUrl.toString());
    tenancy = createTypeOrmTenancy({
      manager,
      dataSource,
      strategy: "schemaPerTenant",
      schema: (tenant) => tenant.schema,
      centralSchema,
      tenantEntities: [{ entity: PostEntity, table: "posts" }],
    });
    await expect(tenancy.validate()).resolves.toMatchObject({ valid: true });
  });

  afterAll(async () => {
    await tenancy?.close();
    if (dataSource?.isInitialized) await dataSource.destroy();
    if (admin !== undefined) {
      for (const schema of [schemaA, schemaB, centralSchema]) {
        await admin.schema.dropSchemaIfExists(schema, true);
      }
      await admin.raw(`drop role if exists ${runtimeRole}`);
      await admin.destroy();
    }
  });

  const tenantA: Tenant = { id: "tenant-a", schema: schemaA, database: "" };
  const tenantB: Tenant = { id: "tenant-b", schema: schemaB, database: "" };
  const run = <T>(
    tenant: Tenant,
    callback: Parameters<typeof tenancy.run<T>>[0],
  ) => manager.runWithTenant(tenant, () => tenancy.run(callback));

  it("keeps colliding ids isolated across schemas", async () => {
    await run(tenantA, (client) =>
      client.repository(PostEntity).create({ id: "same-id", title: "A" }),
    );
    await run(tenantB, (client) =>
      client.repository(PostEntity).create({ id: "same-id", title: "B" }),
    );
    await expect(
      run(tenantA, (client) => client.repository(PostEntity).findBy()),
    ).resolves.toEqual([{ id: "same-id", title: "A" }]);
    await run(tenantA, (client) =>
      client.repository(PostEntity).update({ id: "same-id" }, { title: "A2" }),
    );
    await expect(
      admin.withSchema(schemaB).table("posts").where("id", "same-id").first(),
    ).resolves.toMatchObject({ title: "B" });
  });

  it("rejects two tenants resolving to the same schema", async () => {
    await run(tenantA, (client) => client.repository(PostEntity).countBy());
    await expect(
      run({ ...tenantB, id: "tenant-c", schema: schemaA }, (client) =>
        client.repository(PostEntity).countBy(),
      ),
    ).rejects.toBeDefined();
  });
});

describePostgres("TypeORM PostgreSQL database-per-tenant isolation", () => {
  const databaseA = `typeorm_dpt_a_${suffix}`;
  const databaseB = `typeorm_dpt_b_${suffix}`;
  const manager = new TenancyManager<Tenant>();
  let admin: Knex;
  let base: DataSource;
  let tenancy: ReturnType<typeof createTypeOrmTenancy<Tenant>>;

  beforeAll(async () => {
    admin = knex({ client: "pg", connection: databaseUrl! });
    for (const database of [databaseA, databaseB]) {
      await admin.raw(`create database ${database}`);
      const client = knex({
        client: "pg",
        connection: databaseUrlFor(database),
      });
      await client.schema.createTable("posts", (table) => {
        table.text("id").primary();
        table.text("title").notNullable();
      });
      await client.destroy();
    }
    base = await createDataSource(databaseUrl!);
    tenancy = createTypeOrmTenancy({
      manager,
      dataSource: base,
      strategy: "databasePerTenant",
      tenantEntities: [{ entity: PostEntity, table: "posts" }],
      connection: (tenant) => ({
        key: tenant.database,
        create: () => createDataSource(databaseUrlFor(tenant.database)),
      }),
    });
    await expect(tenancy.validate()).resolves.toMatchObject({ valid: true });
  });

  afterAll(async () => {
    await tenancy?.close();
    if (base?.isInitialized) await base.destroy();
    if (admin !== undefined) {
      await admin.raw(`drop database if exists ${databaseA} with (force)`);
      await admin.raw(`drop database if exists ${databaseB} with (force)`);
      await admin.destroy();
    }
  });

  const tenantA: Tenant = { id: "tenant-a", schema: "", database: databaseA };
  const tenantB: Tenant = { id: "tenant-b", schema: "", database: databaseB };
  const run = <T>(
    tenant: Tenant,
    callback: Parameters<typeof tenancy.run<T>>[0],
  ) => manager.runWithTenant(tenant, () => tenancy.run(callback));

  it("keeps colliding ids isolated across databases", async () => {
    await run(tenantA, (client) =>
      client.repository(PostEntity).create({ id: "same-id", title: "A" }),
    );
    await run(tenantB, (client) =>
      client.repository(PostEntity).create({ id: "same-id", title: "B" }),
    );
    await expect(
      run(tenantA, (client) => client.repository(PostEntity).findBy()),
    ).resolves.toEqual([{ id: "same-id", title: "A" }]);
    await run(tenantA, (client) =>
      client.repository(PostEntity).delete({ id: "same-id" }),
    );
    await expect(
      run(tenantB, (client) => client.repository(PostEntity).findBy()),
    ).resolves.toEqual([{ id: "same-id", title: "B" }]);
  });

  it("rejects two tenants resolving to the same database placement", async () => {
    await run(tenantA, (client) => client.repository(PostEntity).countBy());
    await expect(
      run({ ...tenantB, id: "tenant-c", database: databaseA }, (client) =>
        client.repository(PostEntity).countBy(),
      ),
    ).rejects.toMatchObject({ code: "TENANCY_RESOURCE_CACHE_COLLISION" });
  });
});
