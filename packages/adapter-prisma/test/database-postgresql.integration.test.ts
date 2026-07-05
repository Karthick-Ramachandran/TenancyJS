import { PrismaPg } from "@prisma/adapter-pg";
import { TenancyManager } from "@tenancyjs/core";
import knex, { type Knex } from "knex";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaClient } from "../../../.artifacts/prisma/adapter-prisma/client.js";
import { createPrismaDatabaseTenancy } from "../src/index.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describePostgres = databaseUrl === undefined ? describe.skip : describe;
const suffix = `${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
const databaseA = `prisma_dpt_a_${suffix}`;
const databaseB = `prisma_dpt_b_${suffix}`;

interface DatabaseTenant {
  readonly id: string;
  readonly database: string;
}

function urlFor(database: string): string {
  const url = new URL(databaseUrl!);
  url.pathname = `/${database}`;
  return url.toString();
}

async function withConnection<TResult>(
  database: string,
  callback: (client: Knex) => Promise<TResult>,
): Promise<TResult> {
  const client = knex({ client: "pg", connection: urlFor(database) });
  try {
    return await callback(client);
  } finally {
    await client.destroy();
  }
}

describePostgres("Prisma PostgreSQL database-per-tenant isolation", () => {
  let admin: Knex;
  let manager: TenancyManager<DatabaseTenant>;
  let router: ReturnType<
    typeof createPrismaDatabaseTenancy<DatabaseTenant, PrismaClient>
  >;

  beforeAll(async () => {
    admin = knex({ client: "pg", connection: databaseUrl! });
    for (const database of [databaseA, databaseB]) {
      await admin.raw(`create database ${database}`);
      await withConnection(database, (client) =>
        client.raw(
          'create table "Post" (id text primary key, "tenantId" text not null, title text not null, published boolean not null default false)',
        ),
      );
    }
    manager = new TenancyManager<DatabaseTenant>();
    router = createPrismaDatabaseTenancy<DatabaseTenant, PrismaClient>({
      manager,
      connection: (tenant) => ({
        key: tenant.database,
        create: () =>
          new PrismaClient({
            adapter: new PrismaPg({
              connectionString: urlFor(tenant.database),
            }),
          }),
      }),
      disconnect: (client) => client.$disconnect(),
    });
  });

  beforeEach(async () => {
    for (const database of [databaseA, databaseB]) {
      await withConnection(database, (client) => client("Post").delete());
    }
  });

  afterAll(async () => {
    await router?.close();
    if (admin !== undefined) {
      await admin.raw(`drop database if exists ${databaseA} with (force)`);
      await admin.raw(`drop database if exists ${databaseB} with (force)`);
      await admin.destroy();
    }
  });

  const tenantA: DatabaseTenant = { id: "tenant-a", database: databaseA };
  const tenantB: DatabaseTenant = { id: "tenant-b", database: databaseB };

  function runInTenant<TResult>(
    tenant: DatabaseTenant,
    callback: (client: PrismaClient) => Promise<TResult>,
  ): Promise<TResult> {
    return manager.runWithTenant(tenant, () => router.run(callback));
  }

  it("routes each tenant to its own database and never crosses", async () => {
    await runInTenant(tenantA, (client) =>
      client.post.create({
        data: { id: "post-a", tenantId: "tenant-a", title: "A" },
      }),
    );
    await runInTenant(tenantB, (client) =>
      client.post.create({
        data: { id: "post-b", tenantId: "tenant-b", title: "B" },
      }),
    );

    const [rowsA, rowsB] = await Promise.all([
      runInTenant(tenantA, (client) =>
        client.post.findMany({ orderBy: { id: "asc" } }),
      ),
      runInTenant(tenantB, (client) =>
        client.post.findMany({ orderBy: { id: "asc" } }),
      ),
    ]);
    expect(rowsA.map((row) => row.id)).toEqual(["post-a"]);
    expect(rowsB.map((row) => row.id)).toEqual(["post-b"]);

    // Adversarial: tenant A cannot read tenant B's post — separate database.
    const aSeesB = await runInTenant(tenantA, (client) =>
      client.post.findUnique({ where: { id: "post-b" } }),
    );
    expect(aSeesB).toBeNull();

    await expect(
      withConnection(databaseB, (client) =>
        client("Post").where("id", "post-b").first(),
      ),
    ).resolves.toMatchObject({ title: "B" });
  });

  it("reuses one cached client across concurrent leases of a tenant", async () => {
    await runInTenant(tenantA, (client) =>
      client.post.create({
        data: { id: "shared", tenantId: "tenant-a", title: "Shared" },
      }),
    );
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        runInTenant(tenantA, (client) =>
          client.post.findMany({ where: { id: "shared" } }),
        ),
      ),
    );
    for (const rows of results)
      expect(rows.map((row) => row.id)).toEqual(["shared"]);
  });
});
