import { TenancyManager } from "tenancyjs-core";
import knex, { type Knex } from "knex";
import { DataTypes, type Model, type ModelStatic, Sequelize } from "sequelize";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createSequelizeTenancy } from "../src/index.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describePostgres = databaseUrl === undefined ? describe.skip : describe;
const suffix = `${process.pid}_${Math.random().toString(36).slice(2, 8)}`;

interface Tenant {
  readonly id: string;
  readonly schema: string;
  readonly database: string;
}

function databaseUrlFor(database: string): string {
  const url = new URL(databaseUrl!);
  url.pathname = `/${database}`;
  return url.toString();
}

function createSequelize(
  url: string,
  modelName: string,
): {
  sequelize: Sequelize;
  post: ModelStatic<Model>;
} {
  const sequelize = new Sequelize(url, {
    dialect: "postgres",
    logging: false,
    pool: { min: 0, max: 2 },
  });
  const post = sequelize.define(
    modelName,
    {
      id: { type: DataTypes.STRING, primaryKey: true },
      title: { type: DataTypes.STRING, allowNull: false },
    },
    { tableName: "posts", timestamps: false },
  );
  return { sequelize, post };
}

describePostgres("Sequelize PostgreSQL schema-per-tenant isolation", () => {
  const schemaA = `sequelize_spt_a_${suffix}`;
  const schemaB = `sequelize_spt_b_${suffix}`;
  const centralSchema = `sequelize_spt_c_${suffix}`;
  const runtimeRole = `sequelize_spt_runtime_${suffix}`;
  const manager = new TenancyManager<Tenant>();
  let admin: Knex;
  let sequelize: Sequelize;
  let post: ModelStatic<Model>;
  let tenancy: ReturnType<typeof createSequelizeTenancy<Tenant>>;

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
    ({ sequelize, post } = createSequelize(
      runtimeUrl.toString(),
      `SchemaPost_${suffix}`,
    ));
    tenancy = createSequelizeTenancy({
      manager,
      sequelize,
      strategy: "schemaPerTenant",
      schema: (tenant) => tenant.schema,
      centralSchema,
      tenantModels: [{ model: post, table: "posts" }],
    });
    await expect(tenancy.validate()).resolves.toMatchObject({ valid: true });
  });

  afterAll(async () => {
    await tenancy?.close();
    await sequelize?.close();
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
      client.model(post).create({ id: "same-id", title: "A" }),
    );
    await run(tenantB, (client) =>
      client.model(post).create({ id: "same-id", title: "B" }),
    );
    await expect(
      run(tenantA, (client) => client.model(post).findAll()),
    ).resolves.toEqual([{ id: "same-id", title: "A" }]);
    await run(tenantA, (client) =>
      client.model(post).update({ id: "same-id" }, { title: "A2" }),
    );
    await expect(
      admin.withSchema(schemaB).table("posts").where("id", "same-id").first(),
    ).resolves.toMatchObject({ title: "B" });
  });

  it("rejects two tenants resolving to the same schema", async () => {
    await run(tenantA, (client) => client.model(post).count());
    await expect(
      run({ ...tenantB, id: "tenant-c", schema: schemaA }, (client) =>
        client.model(post).count(),
      ),
    ).rejects.toBeDefined();
  });
});

describePostgres("Sequelize PostgreSQL database-per-tenant isolation", () => {
  const databaseA = `sequelize_dpt_a_${suffix}`;
  const databaseB = `sequelize_dpt_b_${suffix}`;
  const modelName = `DatabasePost_${suffix}`;
  const manager = new TenancyManager<Tenant>();
  let admin: Knex;
  let base: Sequelize;
  let post: ModelStatic<Model>;
  let tenancy: ReturnType<typeof createSequelizeTenancy<Tenant>>;

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
    ({ sequelize: base, post } = createSequelize(databaseUrl!, modelName));
    tenancy = createSequelizeTenancy({
      manager,
      sequelize: base,
      strategy: "databasePerTenant",
      tenantModels: [{ model: post, table: "posts" }],
      connection: (tenant) => ({
        key: tenant.database,
        create: () =>
          createSequelize(databaseUrlFor(tenant.database), modelName).sequelize,
      }),
    });
    await expect(tenancy.validate()).resolves.toMatchObject({ valid: true });
  });

  afterAll(async () => {
    await tenancy?.close();
    await base?.close();
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
      client.model(post).create({ id: "same-id", title: "A" }),
    );
    await run(tenantB, (client) =>
      client.model(post).create({ id: "same-id", title: "B" }),
    );
    await expect(
      run(tenantA, (client) => client.model(post).findAll()),
    ).resolves.toEqual([{ id: "same-id", title: "A" }]);
    await run(tenantA, (client) =>
      client.model(post).delete({ id: "same-id" }),
    );
    await expect(
      run(tenantB, (client) => client.model(post).findAll()),
    ).resolves.toEqual([{ id: "same-id", title: "B" }]);
  });

  it("rejects two tenants resolving to the same database placement", async () => {
    await run(tenantA, (client) => client.model(post).count());
    await expect(
      run({ ...tenantB, id: "tenant-c", database: databaseA }, (client) =>
        client.model(post).count(),
      ),
    ).rejects.toMatchObject({ code: "TENANCY_RESOURCE_CACHE_COLLISION" });
  });
});
