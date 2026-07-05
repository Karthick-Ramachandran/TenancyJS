import { TenancyManager } from "tenancyjs-core";
import { createPool, type Pool } from "mysql2/promise";
import { DataTypes, type Model, type ModelStatic, Sequelize } from "sequelize";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createSequelizeTenancy } from "../src/index.js";

const databaseUrl = process.env.MYSQL_TEST_DATABASE_URL;
const describeMysql = databaseUrl === undefined ? describe.skip : describe;
const suffix = `${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
const rowTable = `sequelize_mysql_row_${suffix}`;

interface Tenant {
  readonly id: string;
  readonly database: string;
}

function urlFor(database: string): string {
  const url = new URL(databaseUrl!);
  url.pathname = `/${database}`;
  return url.toString();
}

function createSequelize(
  url: string,
  modelName: string,
  tableName: string,
  row: boolean,
) {
  const sequelize = new Sequelize(url, {
    dialect: "mysql",
    logging: false,
    pool: { min: 0, max: 2 },
  });
  const post = sequelize.define(
    modelName,
    {
      id: { type: DataTypes.STRING, primaryKey: true },
      ...(row
        ? {
            tenantId: {
              field: "tenant_id",
              type: DataTypes.STRING,
              primaryKey: true,
            },
          }
        : {}),
      title: { type: DataTypes.STRING, allowNull: false },
    },
    { tableName, timestamps: false },
  );
  return { sequelize, post };
}

describeMysql("Sequelize MySQL adapter-enforced row isolation", () => {
  const manager = new TenancyManager<Tenant>();
  let admin: Pool;
  let sequelize: Sequelize;
  let post: ModelStatic<Model>;
  let tenancy: ReturnType<typeof createSequelizeTenancy<Tenant>>;

  beforeAll(async () => {
    admin = createPool(databaseUrl!);
    await admin.query(
      `CREATE TABLE \`${rowTable}\` (id varchar(64) NOT NULL, tenant_id varchar(64) NOT NULL, title varchar(255) NOT NULL, PRIMARY KEY (id, tenant_id))`,
    );
    ({ sequelize, post } = createSequelize(
      databaseUrl!,
      `MysqlRowPost_${suffix}`,
      rowTable,
      true,
    ));
    tenancy = createSequelizeTenancy({
      manager,
      sequelize,
      dialect: "mysql",
      tenantModels: [{ model: post, table: rowTable }],
    });
    await expect(tenancy.validate()).resolves.toMatchObject({
      valid: true,
      issues: [{ code: "TENANCY_SEQUELIZE_ROW_ISOLATION_ADAPTER_ENFORCED" }],
    });
  });

  afterAll(async () => {
    await tenancy?.close();
    await sequelize?.close();
    if (admin !== undefined) {
      await admin.query(`DROP TABLE IF EXISTS \`${rowTable}\``);
      await admin.end();
    }
  });

  const run = <T>(
    tenant: Tenant,
    callback: Parameters<typeof tenancy.run<T>>[0],
  ) => manager.runWithTenant(tenant, () => tenancy.run(callback));

  it("keeps colliding ids isolated through every protected mutation", async () => {
    const tenantA = { id: "tenant-a", database: "" };
    const tenantB = { id: "tenant-b", database: "" };
    await run(tenantA, (client) =>
      client.model(post).create({ id: "same-id", title: "A" }),
    );
    await run(tenantB, (client) =>
      client.model(post).create({ id: "same-id", title: "B" }),
    );
    await expect(
      run(tenantA, (client) => client.model(post).findAll()),
    ).resolves.toEqual([{ id: "same-id", tenantId: "tenant-a", title: "A" }]);
    await run(tenantA, (client) =>
      client.model(post).update({ id: "same-id" }, { title: "A2" }),
    );
    await run(tenantA, (client) =>
      client.model(post).delete({ id: "same-id" }),
    );
    await expect(
      run(tenantB, (client) => client.model(post).findAll()),
    ).resolves.toEqual([{ id: "same-id", tenantId: "tenant-b", title: "B" }]);
  });
});

describeMysql("Sequelize MySQL database-per-tenant isolation", () => {
  const databaseA = `sequelize_mysql_a_${suffix}`;
  const databaseB = `sequelize_mysql_b_${suffix}`;
  const modelName = `MysqlDatabasePost_${suffix}`;
  const manager = new TenancyManager<Tenant>();
  let admin: Pool;
  let base: Sequelize;
  let post: ModelStatic<Model>;
  let tenancy: ReturnType<typeof createSequelizeTenancy<Tenant>>;

  beforeAll(async () => {
    admin = createPool(databaseUrl!);
    for (const database of [databaseA, databaseB]) {
      await admin.query(`CREATE DATABASE \`${database}\``);
      await admin.query(
        `CREATE TABLE \`${database}\`.posts (id varchar(64) PRIMARY KEY, title varchar(255) NOT NULL)`,
      );
    }
    ({ sequelize: base, post } = createSequelize(
      databaseUrl!,
      modelName,
      "posts",
      false,
    ));
    tenancy = createSequelizeTenancy({
      manager,
      sequelize: base,
      dialect: "mysql",
      strategy: "databasePerTenant",
      tenantModels: [{ model: post, table: "posts" }],
      connection: (tenant) => ({
        key: tenant.database,
        create: () =>
          createSequelize(urlFor(tenant.database), modelName, "posts", false)
            .sequelize,
      }),
    });
    await expect(tenancy.validate()).resolves.toMatchObject({ valid: true });
  });

  afterAll(async () => {
    await tenancy?.close();
    await base?.close();
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

  it("keeps colliding ids isolated in separate databases", async () => {
    const tenantA = { id: "tenant-a", database: databaseA };
    const tenantB = { id: "tenant-b", database: databaseB };
    await run(tenantA, (client) =>
      client.model(post).create({ id: "same-id", title: "A" }),
    );
    await run(tenantB, (client) =>
      client.model(post).create({ id: "same-id", title: "B" }),
    );
    await run(tenantA, (client) =>
      client.model(post).delete({ id: "same-id" }),
    );
    await expect(
      run(tenantB, (client) => client.model(post).findAll()),
    ).resolves.toEqual([{ id: "same-id", title: "B" }]);
  });

  it("rejects two tenants resolving to the same database placement", async () => {
    await run({ id: "tenant-a", database: databaseA }, (client) =>
      client.model(post).count(),
    );
    await expect(
      run({ id: "tenant-c", database: databaseA }, (client) =>
        client.model(post).count(),
      ),
    ).rejects.toMatchObject({ code: "TENANCY_RESOURCE_CACHE_COLLISION" });
  });
});
