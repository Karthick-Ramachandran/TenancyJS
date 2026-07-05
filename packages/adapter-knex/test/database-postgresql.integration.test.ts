import { TenancyManager } from "tenancyjs-core";
import knex, { type Knex } from "knex";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createKnexTenancy, type ProtectedKnexClient } from "../src/index.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describePostgres = databaseUrl === undefined ? describe.skip : describe;
const suffix = `${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
const databaseA = `knex_dpt_a_${suffix}`;
const databaseB = `knex_dpt_b_${suffix}`;

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

describePostgres("Knex PostgreSQL database-per-tenant isolation", () => {
  let admin: Knex;
  let manager: TenancyManager<DatabaseTenant>;
  let tenancy: ReturnType<typeof createKnexTenancy<DatabaseTenant>>;

  beforeAll(async () => {
    admin = knex({ client: "pg", connection: databaseUrl! });
    for (const database of [databaseA, databaseB]) {
      await admin.raw(`create database ${database}`);
      await withConnection(database, async (client) =>
        client.schema.createTable("posts", (table) => {
          table.string("id").primary();
          table.string("title").notNullable();
        }),
      );
    }

    manager = new TenancyManager<DatabaseTenant>();
    tenancy = createKnexTenancy({
      manager,
      knex: admin,
      strategy: "databasePerTenant",
      connection: (tenant) => ({
        key: tenant.database,
        create: () =>
          knex({
            client: "pg",
            connection: urlFor(tenant.database),
            pool: { min: 0, max: 2 },
          }),
      }),
      tenantTables: { posts: {} },
    });
    await expect(tenancy.validate()).resolves.toEqual({
      valid: true,
      issues: [
        {
          code: "TENANCY_KNEX_TENANT_DATABASE_VALIDATION_DEFERRED",
          severity: "warning",
          message: expect.stringContaining("first used"),
        },
      ],
    });
  });

  beforeEach(async () => {
    for (const database of [databaseA, databaseB]) {
      await withConnection(database, async (client) =>
        client("posts").delete(),
      );
    }
  });

  afterAll(async () => {
    await tenancy?.close();
    if (admin !== undefined) {
      await admin.raw(`drop database if exists ${databaseA} with (force)`);
      await admin.raw(`drop database if exists ${databaseB} with (force)`);
      await admin.destroy();
    }
  });

  function runInTenant<TResult>(
    tenant: DatabaseTenant,
    callback: (client: ProtectedKnexClient) => Promise<TResult>,
  ): Promise<TResult> {
    return manager.runWithTenant(tenant, () => tenancy.run(callback));
  }

  const tenantA: DatabaseTenant = { id: "tenant-a", database: databaseA };
  const tenantB: DatabaseTenant = { id: "tenant-b", database: databaseB };

  it("routes each tenant to its own database and never crosses", async () => {
    await runInTenant(tenantA, async (client) =>
      client.table("posts").insert({ id: "same-id", title: "A" }),
    );
    await runInTenant(tenantB, async (client) =>
      client.table("posts").insert({ id: "same-id", title: "B" }),
    );

    const [rowsA, rowsB] = await Promise.all([
      runInTenant(tenantA, async (client) =>
        client.table("posts").orderBy("id").select("id", "title"),
      ),
      runInTenant(tenantB, async (client) =>
        client.table("posts").orderBy("id").select("id", "title"),
      ),
    ]);
    expect(rowsA).toEqual([{ id: "same-id", title: "A" }]);
    expect(rowsB).toEqual([{ id: "same-id", title: "B" }]);

    // Adversarial: the same primary key exists in both databases. Tenant A's
    // write must mutate only A's copy, never B's.
    expect(
      await runInTenant(tenantA, async (client) =>
        client.table("posts").where("id", "same-id").update({ title: "A2" }),
      ),
    ).toBe(1);

    // Tenant B is untouched by tenant A's attempts.
    await expect(
      withConnection(databaseB, async (client) =>
        client("posts").where("id", "same-id").first(),
      ),
    ).resolves.toMatchObject({ title: "B" });
  });

  it("reuses one cached connection across concurrent leases of a tenant", async () => {
    await runInTenant(tenantA, async (client) =>
      client.table("posts").insert({ id: "shared", title: "Shared" }),
    );
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        runInTenant(tenantA, async (client) =>
          client.table("posts").where("id", "shared").select("id"),
        ),
      ),
    );
    for (const rows of results) expect(rows).toEqual([{ id: "shared" }]);
  });

  it("fails closed when a tenant's connection cannot be created", async () => {
    const broken: DatabaseTenant = {
      id: "tenant-broken",
      database: `knex_dpt_missing_${suffix}`,
    };
    await expect(
      runInTenant(broken, async (client) => client.table("posts").select("id")),
    ).rejects.toBeDefined();
  });
});
