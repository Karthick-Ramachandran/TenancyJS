import { drizzle } from "drizzle-orm/node-postgres";
import { pgSchema, pgTable, text } from "drizzle-orm/pg-core";
import { TenancyManager } from "tenancyjs-core";
import knex, { type Knex } from "knex";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDrizzleTenancy,
  createPostgresDrizzleBinding,
} from "../src/index.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describePostgres = databaseUrl === undefined ? describe.skip : describe;
const suffix = `${process.pid}_${Math.random().toString(36).slice(2, 8)}`;

interface Tenant {
  readonly id: string;
  readonly schema: string;
  readonly database: string;
}

function urlFor(database: string): string {
  const url = new URL(databaseUrl!);
  url.pathname = `/${database}`;
  return url.toString();
}

describePostgres("Drizzle PostgreSQL forced-RLS row isolation", () => {
  const schema = `drizzle_row_${suffix}`;
  const role = `drizzle_row_role_${suffix}`;
  const tableName = "posts";
  const policyName = "posts_tenant_isolation";
  const posts = pgSchema(schema).table(tableName, {
    id: text().notNull(),
    tenantId: text("tenant_id").notNull(),
    title: text().notNull(),
  });
  const manager = new TenancyManager<Tenant>();
  let admin: Knex;
  let pool: pg.Pool;
  let tenancy: ReturnType<typeof createDrizzleTenancy<Tenant>>;

  beforeAll(async () => {
    admin = knex({ client: "pg", connection: databaseUrl! });
    await admin.raw(`create role ${role} login nosuperuser nobypassrls`);
    await admin.schema.createSchema(schema);
    await admin.schema.withSchema(schema).createTable(tableName, (table) => {
      table.text("id").notNullable();
      table.text("tenant_id").notNullable();
      table.text("title").notNullable();
      table.primary(["id", "tenant_id"]);
    });
    await admin.raw(
      `alter table ${schema}.${tableName} enable row level security`,
    );
    await admin.raw(
      `alter table ${schema}.${tableName} force row level security`,
    );
    await admin.raw(`
      create policy ${policyName} on ${schema}.${tableName}
      using (
        current_setting('tenancyjs.is_central', true) = 'true'
        or tenant_id = nullif(current_setting('tenancyjs.tenant_id', true), '')
      )
      with check (
        current_setting('tenancyjs.is_central', true) = 'true'
        or tenant_id = nullif(current_setting('tenancyjs.tenant_id', true), '')
      )
    `);
    await admin.raw(`grant usage on schema ${schema} to ${role}`);
    await admin.raw(
      `grant select, insert, update, delete on ${schema}.${tableName} to ${role}`,
    );
    const runtimeUrl = new URL(databaseUrl!);
    runtimeUrl.username = role;
    runtimeUrl.password = "";
    pool = new pg.Pool({ connectionString: runtimeUrl.toString(), max: 2 });
    const database = drizzle({ client: pool });
    tenancy = createDrizzleTenancy({
      manager,
      database: createPostgresDrizzleBinding(database),
      tenantTables: [{ table: posts, policyName }],
    });
    await expect(tenancy.validate()).resolves.toEqual({
      valid: true,
      issues: [],
    });
  });

  afterAll(async () => {
    await tenancy?.close();
    await pool?.end();
    if (admin !== undefined) {
      await admin.schema.dropSchemaIfExists(schema, true);
      await admin.raw(`drop role if exists ${role}`);
      await admin.destroy();
    }
  });

  const run = <T>(
    tenant: Tenant,
    callback: Parameters<typeof tenancy.run<T>>[0],
  ) => manager.runWithTenant(tenant, () => tenancy.run(callback));

  it("isolates colliding ids and prevents cross-tenant mutation", async () => {
    const tenantA = { id: "tenant-a", schema: "", database: "" };
    const tenantB = { id: "tenant-b", schema: "", database: "" };
    await run(tenantA, (client) =>
      client.table(posts).create({ id: "same-id", title: "A" }),
    );
    await run(tenantB, (client) =>
      client.table(posts).create({ id: "same-id", title: "B" }),
    );
    await expect(
      run(tenantA, (client) => client.table(posts).findMany()),
    ).resolves.toEqual([{ id: "same-id", tenantId: "tenant-a", title: "A" }]);
    expect(await run(tenantA, (client) => client.table(posts).count())).toBe(1);
    await run(tenantA, (client) =>
      client.table(posts).update({ id: "same-id" }, { title: "A2" }),
    );
    await run(tenantA, (client) =>
      client.table(posts).delete({ id: "same-id" }),
    );
    await expect(
      run(tenantB, (client) => client.table(posts).findMany()),
    ).resolves.toEqual([{ id: "same-id", tenantId: "tenant-b", title: "B" }]);
  });
});

describePostgres("Drizzle PostgreSQL schema-per-tenant isolation", () => {
  const schemaA = `drizzle_schema_a_${suffix}`;
  const schemaB = `drizzle_schema_b_${suffix}`;
  const centralSchema = `drizzle_schema_c_${suffix}`;
  const role = `drizzle_schema_role_${suffix}`;
  const tableName = `drizzle_schema_posts_${suffix}`;
  const posts = pgTable(tableName, {
    id: text().primaryKey(),
    title: text().notNull(),
  });
  const manager = new TenancyManager<Tenant>();
  let admin: Knex;
  let pool: pg.Pool;
  let tenancy: ReturnType<typeof createDrizzleTenancy<Tenant>>;

  beforeAll(async () => {
    admin = knex({ client: "pg", connection: databaseUrl! });
    for (const schema of [schemaA, schemaB, centralSchema])
      await admin.schema.createSchema(schema);
    for (const schema of [schemaA, schemaB]) {
      await admin.schema.withSchema(schema).createTable(tableName, (table) => {
        table.text("id").primary();
        table.text("title").notNullable();
      });
    }
    await admin.raw(`create role ${role} login nosuperuser nobypassrls`);
    await admin.raw(
      `grant usage on schema ${schemaA}, ${schemaB}, ${centralSchema} to ${role}`,
    );
    await admin.raw(
      `grant select, insert, update, delete on ${schemaA}.${tableName}, ${schemaB}.${tableName} to ${role}`,
    );
    const runtimeUrl = new URL(databaseUrl!);
    runtimeUrl.username = role;
    runtimeUrl.password = "";
    pool = new pg.Pool({ connectionString: runtimeUrl.toString(), max: 2 });
    tenancy = createDrizzleTenancy({
      manager,
      database: createPostgresDrizzleBinding(drizzle({ client: pool })),
      strategy: "schemaPerTenant",
      schema: (tenant) => tenant.schema,
      centralSchema,
      tenantTables: [{ table: posts }],
    });
    await expect(tenancy.validate()).resolves.toMatchObject({ valid: true });
  });

  afterAll(async () => {
    await tenancy?.close();
    await pool?.end();
    if (admin !== undefined) {
      for (const schema of [schemaA, schemaB, centralSchema])
        await admin.schema.dropSchemaIfExists(schema, true);
      await admin.raw(`drop role if exists ${role}`);
      await admin.destroy();
    }
  });

  const run = <T>(
    tenant: Tenant,
    callback: Parameters<typeof tenancy.run<T>>[0],
  ) => manager.runWithTenant(tenant, () => tenancy.run(callback));

  it("isolates colliding ids across schemas", async () => {
    const tenantA = { id: "tenant-a", schema: schemaA, database: "" };
    const tenantB = { id: "tenant-b", schema: schemaB, database: "" };
    await run(tenantA, (client) =>
      client.table(posts).create({ id: "same-id", title: "A" }),
    );
    await run(tenantB, (client) =>
      client.table(posts).create({ id: "same-id", title: "B" }),
    );
    await run(tenantA, (client) =>
      client.table(posts).delete({ id: "same-id" }),
    );
    await expect(
      run(tenantB, (client) => client.table(posts).findMany()),
    ).resolves.toEqual([{ id: "same-id", title: "B" }]);
  });

  it("rejects two tenants resolving to the same schema", async () => {
    await run({ id: "tenant-a", schema: schemaA, database: "" }, (client) =>
      client.table(posts).count(),
    );
    await expect(
      run({ id: "tenant-c", schema: schemaA, database: "" }, (client) =>
        client.table(posts).count(),
      ),
    ).rejects.toBeDefined();
  });
});

describePostgres("Drizzle PostgreSQL database-per-tenant isolation", () => {
  const databaseA = `drizzle_db_a_${suffix}`;
  const databaseB = `drizzle_db_b_${suffix}`;
  const posts = pgTable("posts", {
    id: text().primaryKey(),
    title: text().notNull(),
  });
  const manager = new TenancyManager<Tenant>();
  let admin: Knex;
  let basePool: pg.Pool;
  let tenancy: ReturnType<typeof createDrizzleTenancy<Tenant>>;

  beforeAll(async () => {
    admin = knex({ client: "pg", connection: databaseUrl! });
    for (const database of [databaseA, databaseB]) {
      await admin.raw(`create database ${database}`);
      const client = knex({ client: "pg", connection: urlFor(database) });
      await client.schema.createTable("posts", (table) => {
        table.text("id").primary();
        table.text("title").notNullable();
      });
      await client.destroy();
    }
    basePool = new pg.Pool({ connectionString: databaseUrl! });
    tenancy = createDrizzleTenancy({
      manager,
      database: createPostgresDrizzleBinding(drizzle({ client: basePool })),
      strategy: "databasePerTenant",
      tenantTables: [{ table: posts }],
      connection: (tenant) => ({
        key: tenant.database,
        create: () => {
          const pool = new pg.Pool({
            connectionString: urlFor(tenant.database),
            max: 2,
          });
          return createPostgresDrizzleBinding(drizzle({ client: pool }), {
            close: () => pool.end(),
          });
        },
      }),
    });
    await expect(tenancy.validate()).resolves.toMatchObject({ valid: true });
  });

  afterAll(async () => {
    await tenancy?.close();
    await basePool?.end();
    if (admin !== undefined) {
      await admin.raw(`drop database if exists ${databaseA}`);
      await admin.raw(`drop database if exists ${databaseB}`);
      await admin.destroy();
    }
  });

  const run = <T>(
    tenant: Tenant,
    callback: Parameters<typeof tenancy.run<T>>[0],
  ) => manager.runWithTenant(tenant, () => tenancy.run(callback));

  it("isolates colliding ids across databases", async () => {
    const tenantA = { id: "tenant-a", schema: "", database: databaseA };
    const tenantB = { id: "tenant-b", schema: "", database: databaseB };
    await run(tenantA, (client) =>
      client.table(posts).create({ id: "same-id", title: "A" }),
    );
    await run(tenantB, (client) =>
      client.table(posts).create({ id: "same-id", title: "B" }),
    );
    await run(tenantA, (client) =>
      client.table(posts).delete({ id: "same-id" }),
    );
    await expect(
      run(tenantB, (client) => client.table(posts).findMany()),
    ).resolves.toEqual([{ id: "same-id", title: "B" }]);
  });

  it("rejects two tenants resolving to the same database placement", async () => {
    await run({ id: "tenant-a", schema: "", database: databaseA }, (client) =>
      client.table(posts).count(),
    );
    await expect(
      run({ id: "tenant-c", schema: "", database: databaseA }, (client) =>
        client.table(posts).count(),
      ),
    ).rejects.toMatchObject({ code: "TENANCY_RESOURCE_CACHE_COLLISION" });
  });
});
