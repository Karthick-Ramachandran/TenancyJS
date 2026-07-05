import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { TenancyManager } from "tenancyjs-core";
import mariadb, { type Connection } from "mariadb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaClient } from "../../../.artifacts/prisma/adapter-prisma-mysql/client.js";
import { createPrismaDatabaseTenancy } from "../src/index.js";

const databaseUrl = process.env.MYSQL_TEST_DATABASE_URL;
const describeMysql = databaseUrl === undefined ? describe.skip : describe;
const suffix = `${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
const databaseA = `prisma_dpt_a_${suffix}`;
const databaseB = `prisma_dpt_b_${suffix}`;

interface DatabaseTenant {
  readonly id: string;
  readonly database: string;
}

function urlFor(database: string): string {
  const url = new URL(databaseUrl!);
  url.protocol = "mariadb:";
  url.pathname = `/${database}`;
  return url.toString();
}

describeMysql("Prisma MySQL database-per-tenant isolation", () => {
  let admin: Connection;
  let manager: TenancyManager<DatabaseTenant>;
  let tenancy: ReturnType<
    typeof createPrismaDatabaseTenancy<DatabaseTenant, PrismaClient>
  >;

  beforeAll(async () => {
    const adminUrl = new URL(databaseUrl!);
    adminUrl.protocol = "mariadb:";
    admin = await mariadb.createConnection(adminUrl.toString());
    for (const database of [databaseA, databaseB]) {
      await admin.query(`create database \`${database}\``);
      await admin.query(`
        create table \`${database}\`.\`Post\` (
          id varchar(191) primary key,
          tenantId varchar(191) not null,
          title varchar(191) not null,
          published boolean not null default false
        )
      `);
    }
    manager = new TenancyManager<DatabaseTenant>();
    tenancy = createPrismaDatabaseTenancy<DatabaseTenant, PrismaClient>({
      manager,
      connection: (tenant) => ({
        key: tenant.database,
        create: () =>
          new PrismaClient({
            adapter: new PrismaMariaDb(urlFor(tenant.database)),
          }),
      }),
      disconnect: (client) => client.$disconnect(),
    });
  });

  beforeEach(async () => {
    for (const database of [databaseA, databaseB]) {
      await admin.query(`delete from \`${database}\`.\`Post\``);
    }
  });

  afterAll(async () => {
    await tenancy?.close();
    if (admin !== undefined) {
      for (const database of [databaseA, databaseB]) {
        await admin.query(`drop database if exists \`${database}\``);
      }
      await admin.end();
    }
  });

  const tenantA: DatabaseTenant = { id: "tenant-a", database: databaseA };
  const tenantB: DatabaseTenant = { id: "tenant-b", database: databaseB };

  function run<TResult>(
    tenant: DatabaseTenant,
    callback: (client: PrismaClient) => Promise<TResult>,
  ): Promise<TResult> {
    return manager.runWithTenant(tenant, () => tenancy.run(callback));
  }

  it("routes colliding ids to distinct MySQL databases", async () => {
    await run(tenantA, (client) =>
      client.post.create({
        data: { id: "same-id", tenantId: "tenant-a", title: "A" },
      }),
    );
    await run(tenantB, (client) =>
      client.post.create({
        data: { id: "same-id", tenantId: "tenant-b", title: "B" },
      }),
    );

    await expect(
      run(tenantA, (client) => client.post.findMany()),
    ).resolves.toEqual([
      expect.objectContaining({ id: "same-id", title: "A" }),
    ]);
    await expect(
      run(tenantB, (client) => client.post.findMany()),
    ).resolves.toEqual([
      expect.objectContaining({ id: "same-id", title: "B" }),
    ]);

    await run(tenantA, (client) =>
      client.post.update({
        where: { id: "same-id" },
        data: { title: "A2" },
      }),
    );
    const rows = await admin.query(
      `select title from \`${databaseB}\`.\`Post\` where id = ?`,
      ["same-id"],
    );
    expect(rows[0]).toMatchObject({ title: "B" });
  });
});
