import { TenancyManager } from "tenancyjs-core";
import { createPool, type Pool } from "mysql2/promise";
import { DataSource, EntitySchema } from "typeorm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTypeOrmTenancy } from "../src/index.js";

const databaseUrl = process.env.MYSQL_TEST_DATABASE_URL;
const describeMysql = databaseUrl === undefined ? describe.skip : describe;
const suffix = `${process.pid}_${Math.random().toString(36).slice(2, 8)}`;

interface Tenant {
  readonly id: string;
  readonly database: string;
}

interface Post {
  id: string;
  tenantId: string;
  title: string;
}

const rowTable = `typeorm_mysql_row_${suffix}`;
const PostEntity = new EntitySchema<Post>({
  name: `MysqlRowPost_${suffix}`,
  tableName: rowTable,
  columns: {
    id: { type: String, primary: true },
    tenantId: { name: "tenant_id", type: String, primary: true },
    title: { type: String },
  },
});

const databaseTable = "posts";
const DatabasePostEntity = new EntitySchema<Omit<Post, "tenantId">>({
  name: `MysqlDatabasePost_${suffix}`,
  tableName: databaseTable,
  columns: {
    id: { type: String, primary: true },
    title: { type: String },
  },
});

function urlFor(database: string): string {
  const url = new URL(databaseUrl!);
  url.pathname = `/${database}`;
  return url.toString();
}

async function dataSource(
  url: string,
  entity: EntitySchema,
): Promise<DataSource> {
  return new DataSource({
    type: "mysql",
    url,
    entities: [entity],
    synchronize: false,
  }).initialize();
}

describeMysql("TypeORM MySQL adapter-enforced row isolation", () => {
  const manager = new TenancyManager<Tenant>();
  let admin: Pool;
  let source: DataSource;
  let tenancy: ReturnType<typeof createTypeOrmTenancy<Tenant>>;

  beforeAll(async () => {
    admin = createPool(databaseUrl!);
    await admin.query(
      `CREATE TABLE \`${rowTable}\` (id varchar(64) NOT NULL, tenant_id varchar(64) NOT NULL, title varchar(255) NOT NULL, PRIMARY KEY (id, tenant_id))`,
    );
    source = await dataSource(databaseUrl!, PostEntity);
    tenancy = createTypeOrmTenancy({
      manager,
      dataSource: source,
      dialect: "mysql",
      tenantEntities: [{ entity: PostEntity, table: rowTable }],
    });
    await expect(tenancy.validate()).resolves.toMatchObject({
      valid: true,
      issues: [{ code: "TENANCY_TYPEORM_ROW_ISOLATION_ADAPTER_ENFORCED" }],
    });
  });

  afterAll(async () => {
    await tenancy?.close();
    if (source?.isInitialized) await source.destroy();
    if (admin !== undefined) {
      await admin.query(`DROP TABLE IF EXISTS \`${rowTable}\``);
      await admin.end();
    }
  });

  const tenantA: Tenant = { id: "tenant-a", database: "" };
  const tenantB: Tenant = { id: "tenant-b", database: "" };
  const run = <T>(
    tenant: Tenant,
    callback: Parameters<typeof tenancy.run<T>>[0],
  ) => manager.runWithTenant(tenant, () => tenancy.run(callback));

  it("keeps colliding ids isolated through every protected mutation", async () => {
    await run(tenantA, (client) =>
      client.repository(PostEntity).create({ id: "same-id", title: "A" }),
    );
    await run(tenantB, (client) =>
      client.repository(PostEntity).create({ id: "same-id", title: "B" }),
    );
    await expect(
      run(tenantA, (client) => client.repository(PostEntity).findBy()),
    ).resolves.toEqual([{ id: "same-id", tenantId: "tenant-a", title: "A" }]);
    await run(tenantA, (client) =>
      client.repository(PostEntity).update({ id: "same-id" }, { title: "A2" }),
    );
    await run(tenantA, (client) =>
      client.repository(PostEntity).delete({ id: "same-id" }),
    );
    await expect(
      run(tenantB, (client) => client.repository(PostEntity).findBy()),
    ).resolves.toEqual([{ id: "same-id", tenantId: "tenant-b", title: "B" }]);
  });
});

describeMysql("TypeORM MySQL database-per-tenant isolation", () => {
  const databaseA = `typeorm_mysql_a_${suffix}`;
  const databaseB = `typeorm_mysql_b_${suffix}`;
  const manager = new TenancyManager<Tenant>();
  let admin: Pool;
  let base: DataSource;
  let tenancy: ReturnType<typeof createTypeOrmTenancy<Tenant>>;

  beforeAll(async () => {
    admin = createPool(databaseUrl!);
    for (const database of [databaseA, databaseB]) {
      await admin.query(`CREATE DATABASE \`${database}\``);
      await admin.query(
        `CREATE TABLE \`${database}\`.\`${databaseTable}\` (id varchar(64) PRIMARY KEY, title varchar(255) NOT NULL)`,
      );
    }
    base = await dataSource(databaseUrl!, DatabasePostEntity);
    tenancy = createTypeOrmTenancy({
      manager,
      dataSource: base,
      dialect: "mysql",
      strategy: "databasePerTenant",
      tenantEntities: [{ entity: DatabasePostEntity, table: databaseTable }],
      connection: (tenant) => ({
        key: tenant.database,
        create: () => dataSource(urlFor(tenant.database), DatabasePostEntity),
      }),
    });
    await expect(tenancy.validate()).resolves.toMatchObject({ valid: true });
  });

  afterAll(async () => {
    await tenancy?.close();
    if (base?.isInitialized) await base.destroy();
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
      client
        .repository(DatabasePostEntity)
        .create({ id: "same-id", title: "A" }),
    );
    await run(tenantB, (client) =>
      client
        .repository(DatabasePostEntity)
        .create({ id: "same-id", title: "B" }),
    );
    await run(tenantA, (client) =>
      client.repository(DatabasePostEntity).delete({ id: "same-id" }),
    );
    await expect(
      run(tenantB, (client) => client.repository(DatabasePostEntity).findBy()),
    ).resolves.toEqual([{ id: "same-id", title: "B" }]);
  });

  it("rejects two tenants resolving to the same database placement", async () => {
    await run({ id: "tenant-a", database: databaseA }, (client) =>
      client.repository(DatabasePostEntity).countBy(),
    );
    await expect(
      run({ id: "tenant-c", database: databaseA }, (client) =>
        client.repository(DatabasePostEntity).countBy(),
      ),
    ).rejects.toMatchObject({ code: "TENANCY_RESOURCE_CACHE_COLLISION" });
  });
});
