import { TenancyManager, TenantContextError } from "@tenancyjs/core";
import knex, { type Knex } from "knex";
import { DataTypes, Model, Sequelize } from "sequelize";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  SequelizeModelUnregisteredError,
  SequelizePolicyValidationError,
  SequelizeTenantFieldConflictError,
  SequelizeUnsafeCriteriaError,
  createSequelizeTenancy,
} from "../src/index.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describePostgres =
  databaseUrl === undefined ? describe.skip : describe.sequential;
const suffix = `${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
const schema = `sequelize_rls_${suffix}`;
const runtimeRole = `sequelize_runtime_${suffix}`;

interface Tenant {
  readonly id: string;
}

class Post extends Model {
  declare id: string;
  declare tenantId: string;
  declare title: string;
}

class Unknown extends Model {}

describePostgres("Sequelize PostgreSQL row-level isolation", () => {
  let admin: Knex;
  let sequelize: Sequelize;
  let manager: TenancyManager<Tenant>;
  let tenancy: ReturnType<typeof createSequelizeTenancy<Tenant>>;

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
    sequelize = new Sequelize(runtimeUrl.toString(), {
      dialect: "postgres",
      logging: false,
      pool: { min: 0, max: 2 },
    });
    Post.init(
      {
        id: { type: DataTypes.STRING, primaryKey: true },
        tenantId: {
          type: DataTypes.STRING,
          field: "tenant_id",
          primaryKey: true,
        },
        title: { type: DataTypes.STRING, allowNull: false },
      },
      { sequelize, tableName: "posts", schema, timestamps: false },
    );
    manager = new TenancyManager<Tenant>();
    tenancy = createSequelizeTenancy({
      manager,
      sequelize,
      tenantModels: [
        {
          model: Post,
          table: `${schema}.posts`,
          tenantAttribute: "tenantId",
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
    await sequelize?.close();
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
      client.model(Post).create({ id: "same-id", title: "A" }),
    );
    await run(tenantB, (client) =>
      client.model(Post).create({ id: "same-id", title: "B" }),
    );
    await expect(
      run(tenantA, (client) => client.model(Post).findAll()),
    ).resolves.toEqual([{ id: "same-id", tenantId: "tenant-a", title: "A" }]);
    await expect(
      run(tenantB, (client) => client.model(Post).count()),
    ).resolves.toBe(1);
    await expect(
      run(tenantA, (client) =>
        client.model(Post).update({ id: "same-id" }, { title: "A2" }),
      ),
    ).resolves.toBe(1);
    await expect(
      run(tenantB, (client) => client.model(Post).findOne({ id: "same-id" })),
    ).resolves.toMatchObject({ title: "B" });
    await expect(
      run(tenantA, (client) => client.model(Post).delete({ id: "same-id" })),
    ).resolves.toBe(1);
    await expect(
      run(tenantB, (client) => client.model(Post).count()),
    ).resolves.toBe(1);
  });

  it("fails closed on missing validation/context, conflicts, unsafe criteria, and unknown models", async () => {
    const locked = createSequelizeTenancy({
      manager,
      sequelize,
      tenantModels: [{ model: Post, table: `${schema}.posts` }],
    });
    await expect(
      manager.runWithTenant(tenantA, () => locked.run(async () => undefined)),
    ).rejects.toBeInstanceOf(SequelizePolicyValidationError);
    await expect(tenancy.run(async () => undefined)).rejects.toBeInstanceOf(
      TenantContextError,
    );
    await expect(
      run(tenantA, (client) =>
        client
          .model(Post)
          .create({ id: "bad", tenantId: "tenant-b", title: "bad" }),
      ),
    ).rejects.toBeInstanceOf(SequelizeTenantFieldConflictError);
    await expect(
      run(tenantA, (client) =>
        client.model(Post).findAll({ id: { raw: true } } as never),
      ),
    ).rejects.toBeInstanceOf(SequelizeUnsafeCriteriaError);
    // Symbol-keyed operators (Sequelize `Op.*`) are invisible to Object.values
    // and must still be rejected by the plain-scalar guard.
    await expect(
      run(tenantA, (client) =>
        client.model(Post).findAll({ [Symbol.for("or")]: [] } as never),
      ),
    ).rejects.toBeInstanceOf(SequelizeUnsafeCriteriaError);
    await expect(
      run(tenantA, (client) => client.model(Unknown as typeof Post).count()),
    ).rejects.toBeInstanceOf(SequelizeModelUnregisteredError);
  });

  it("rolls back callback failures and clears transaction-local state", async () => {
    const failure = new Error("rollback");
    await expect(
      run(tenantA, async (client) => {
        await client.model(Post).create({ id: "rolled-back", title: "A" });
        throw failure;
      }),
    ).rejects.toBe(failure);
    await expect(
      run(tenantA, (client) => client.model(Post).count()),
    ).resolves.toBe(0);
    await expect(Post.findAll({ raw: true })).resolves.toEqual([]);
  });
});
