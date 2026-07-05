import { drizzle } from "drizzle-orm/mysql2";
import { mysqlTable, primaryKey, varchar } from "drizzle-orm/mysql-core";
import { TenancyManager } from "tenancyjs-core";
import { createPool, type Pool } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  DrizzleTenancyConfigurationError,
  createDrizzleTenancy,
  createMySqlDrizzleBinding,
} from "../src/index.js";

const databaseUrl = process.env.MYSQL_TEST_DATABASE_URL;
const describeMysql = databaseUrl === undefined ? describe.skip : describe;
const suffix = `${process.pid}_${Math.random().toString(36).slice(2, 8)}`;

interface Tenant {
  readonly id: string;
  readonly database: string;
}

function urlFor(database: string): string {
  const url = new URL(databaseUrl!);
  url.pathname = `/${database}`;
  return url.toString();
}

describeMysql("Drizzle MySQL adapter-enforced row isolation", () => {
  const tableName = `drizzle_mysql_row_${suffix}`;
  const posts = mysqlTable(
    tableName,
    {
      id: varchar({ length: 64 }).notNull(),
      tenantId: varchar("tenant_id", { length: 64 }).notNull(),
      title: varchar({ length: 255 }).notNull(),
    },
    (table) => [primaryKey({ columns: [table.id, table.tenantId] })],
  );
  const manager = new TenancyManager<Tenant>();
  let admin: Pool;
  let pool: Pool;
  let tenancy: ReturnType<typeof createDrizzleTenancy<Tenant>>;

  beforeAll(async () => {
    admin = createPool(databaseUrl!);
    await admin.query(
      `CREATE TABLE \`${tableName}\` (id varchar(64) NOT NULL, tenant_id varchar(64) NOT NULL, title varchar(255) NOT NULL, PRIMARY KEY (id, tenant_id))`,
    );
    pool = createPool({ uri: databaseUrl!, connectionLimit: 2 });
    tenancy = createDrizzleTenancy({
      manager,
      database: createMySqlDrizzleBinding(drizzle({ client: pool })),
      tenantTables: [{ table: posts }],
    });
    await expect(tenancy.validate()).resolves.toMatchObject({
      valid: true,
      issues: [{ code: "TENANCY_DRIZZLE_ROW_ISOLATION_ADAPTER_ENFORCED" }],
    });
  });

  afterAll(async () => {
    await tenancy?.close();
    await pool?.end();
    if (admin !== undefined) {
      await admin.query(`DROP TABLE IF EXISTS \`${tableName}\``);
      await admin.end();
    }
  });

  const run = <T>(
    tenant: Tenant,
    callback: Parameters<typeof tenancy.run<T>>[0],
  ) => manager.runWithTenant(tenant, () => tenancy.run(callback));

  it("isolates colliding ids through protected reads and mutations", async () => {
    const tenantA = { id: "tenant-a", database: "" };
    const tenantB = { id: "tenant-b", database: "" };
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

describeMysql("Drizzle MySQL database-per-tenant isolation", () => {
  const databaseA = `drizzle_mysql_a_${suffix}`;
  const databaseB = `drizzle_mysql_b_${suffix}`;
  const posts = mysqlTable("posts", {
    id: varchar({ length: 64 }).primaryKey(),
    title: varchar({ length: 255 }).notNull(),
  });
  const manager = new TenancyManager<Tenant>();
  let admin: Pool;
  let basePool: Pool;
  let tenancy: ReturnType<typeof createDrizzleTenancy<Tenant>>;

  beforeAll(async () => {
    admin = createPool(databaseUrl!);
    for (const database of [databaseA, databaseB]) {
      await admin.query(`CREATE DATABASE \`${database}\``);
      await admin.query(
        `CREATE TABLE \`${database}\`.posts (id varchar(64) PRIMARY KEY, title varchar(255) NOT NULL)`,
      );
    }
    basePool = createPool({ uri: databaseUrl!, connectionLimit: 2 });
    tenancy = createDrizzleTenancy({
      manager,
      database: createMySqlDrizzleBinding(drizzle({ client: basePool })),
      strategy: "databasePerTenant",
      tenantTables: [{ table: posts }],
      connection: (tenant) => ({
        key: tenant.database,
        create: () => {
          const pool = createPool({
            uri: urlFor(tenant.database),
            connectionLimit: 2,
          });
          return createMySqlDrizzleBinding(drizzle({ client: pool }), {
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
      for (const database of [databaseA, databaseB])
        await admin.query(`DROP DATABASE IF EXISTS \`${database}\``);
      await admin.end();
    }
  });

  const run = <T>(
    tenant: Tenant,
    callback: Parameters<typeof tenancy.run<T>>[0],
  ) => manager.runWithTenant(tenant, () => tenancy.run(callback));

  it("isolates colliding ids in separate databases", async () => {
    const tenantA = { id: "tenant-a", database: databaseA };
    const tenantB = { id: "tenant-b", database: databaseB };
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
    await run({ id: "tenant-a", database: databaseA }, (client) =>
      client.table(posts).count(),
    );
    await expect(
      run({ id: "tenant-c", database: databaseA }, (client) =>
        client.table(posts).count(),
      ),
    ).rejects.toMatchObject({ code: "TENANCY_RESOURCE_CACHE_COLLISION" });
  });

  it("refuses unrestricted() in central mode — it runs on the shared base binding", async () => {
    // ADR-0033: central mode uses the shared base binding, not a leased tenant
    // database, so the raw handle must stay fail-closed on MySQL too.
    await expect(
      manager.runInCentralContext(() =>
        tenancy.run(async (client) => client.unrestricted()),
      ),
    ).rejects.toBeInstanceOf(DrizzleTenancyConfigurationError);
  });
});
