import { Logger } from "@adonisjs/core/logger";
import { TenancyManager } from "tenancyjs-core";
import { Database } from "@adonisjs/lucid/database";
import { BaseModel, column } from "@adonisjs/lucid/orm";
import knex, { type Knex } from "knex";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  LucidTenancyConfigurationError,
  createLucidTenancy,
  type LucidTenantConnection,
} from "../src/index.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describePostgres =
  databaseUrl === undefined ? describe.skip : describe.sequential;
const suffix = `${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
const databaseA = `lucid_dpt_a_${suffix}`;
const databaseB = `lucid_dpt_b_${suffix}`;
const connectionA = "tenant_a";
const connectionB = "tenant_b";

interface DatabaseTenant {
  readonly id: string;
  readonly connection: string;
}

class Post extends BaseModel {
  static override table = "posts";

  declare id: string;
  declare title: string;
}
column({ isPrimary: true })(Post.prototype, "id");
column()(Post.prototype, "title");

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

describePostgres("Lucid PostgreSQL database-per-tenant isolation", () => {
  let admin: Knex;
  let database: Database;
  let manager: TenancyManager<DatabaseTenant>;
  let tenancy: ReturnType<typeof createLucidTenancy<DatabaseTenant>>;

  beforeAll(async () => {
    admin = knex({ client: "pg", connection: databaseUrl! });
    for (const name of [databaseA, databaseB]) {
      await admin.raw(`create database ${name}`);
      await withConnection(name, async (client) =>
        client.schema.createTable("posts", (table) => {
          table.string("id").primary();
          table.string("title").notNullable();
        }),
      );
    }

    database = new Database(
      {
        connection: "postgres",
        connections: {
          postgres: {
            client: "pg",
            connection: databaseUrl!,
            pool: { min: 0, max: 2 },
          },
          [connectionA]: {
            client: "pg",
            connection: urlFor(databaseA),
            pool: { min: 0, max: 2 },
          },
          [connectionB]: {
            client: "pg",
            connection: urlFor(databaseB),
            pool: { min: 0, max: 2 },
          },
        },
      },
      new Logger({ enabled: false }),
      {
        emit: async () => undefined,
        hasListeners: () => false,
      } as never,
    );
    BaseModel.useAdapter(database.modelAdapter());
    manager = new TenancyManager<DatabaseTenant>();
    tenancy = createLucidTenancy({
      manager,
      database,
      strategy: "databasePerTenant",
      connection: (tenant) => ({
        key: tenant.connection,
        create: (): LucidTenantConnection => ({
          transaction: (callback) =>
            database.connection(tenant.connection).transaction(callback),
          destroy: () => database.manager.close(tenant.connection),
        }),
      }),
      tenantModels: [{ model: Post }],
    });
    await expect(tenancy.validate()).resolves.toEqual({
      valid: true,
      issues: [
        {
          code: "TENANCY_LUCID_TENANT_DATABASE_VALIDATION_DEFERRED",
          severity: "warning",
          message: expect.stringContaining("first used"),
        },
      ],
    });
  });

  beforeEach(async () => {
    for (const name of [databaseA, databaseB]) {
      await withConnection(name, async (client) => client("posts").delete());
    }
  });

  afterAll(async () => {
    await tenancy?.close();
    await database?.manager.closeAll();
    if (admin !== undefined) {
      await admin.raw(`drop database if exists ${databaseA} with (force)`);
      await admin.raw(`drop database if exists ${databaseB} with (force)`);
      await admin.destroy();
    }
  });

  const tenantA: DatabaseTenant = { id: "tenant-a", connection: connectionA };
  const tenantB: DatabaseTenant = { id: "tenant-b", connection: connectionB };

  function runInTenant<TResult>(
    tenant: DatabaseTenant,
    callback: () => Promise<TResult>,
  ): Promise<TResult> {
    return manager.runWithTenant(tenant, () => tenancy.run(callback));
  }

  async function createPost(id: string, title: string): Promise<void> {
    const post = new Post();
    post.id = id;
    post.title = title;
    await post.save();
  }

  it("routes each tenant to its own database and never crosses", async () => {
    await runInTenant(tenantA, () => createPost("same-id", "A"));
    await runInTenant(tenantB, () => createPost("same-id", "B"));

    const rowsA = await runInTenant(tenantA, async () =>
      Post.query().orderBy("id"),
    );
    const rowsB = await runInTenant(tenantB, async () =>
      Post.query().orderBy("id"),
    );
    expect(rowsA.map((row) => [row.id, row.title])).toEqual([["same-id", "A"]]);
    expect(rowsB.map((row) => [row.id, row.title])).toEqual([["same-id", "B"]]);

    // Adversarial: mutate the colliding primary key through tenant A and
    // prove tenant B's copy is unchanged.
    await runInTenant(tenantA, async () => {
      const post = await Post.findByOrFail("id", "same-id");
      post.title = "A2";
      await post.save();
    });

    await expect(
      withConnection(databaseB, async (client) =>
        client("posts").where("id", "same-id").first(),
      ),
    ).resolves.toMatchObject({ title: "B" });
  });

  it("reuses one cached connection across concurrent leases of a tenant", async () => {
    await runInTenant(tenantA, () => createPost("shared", "Shared"));
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        runInTenant(tenantA, async () => Post.query()),
      ),
    );
    for (const rows of results)
      expect(rows.map((row) => row.id)).toEqual(["shared"]);
  });

  it("fails closed when a tenant's connection is unknown", async () => {
    const broken: DatabaseTenant = {
      id: "tenant-broken",
      connection: "does_not_exist",
    };
    await expect(
      runInTenant(broken, async () => Post.query()),
    ).rejects.toBeDefined();
  });

  // ADR-0033: scope.unrestricted() hands back the tenant's own leased
  // transaction, so raw SQL and joins can't cross tenants.
  it("unrestricted() raw SQL stays inside the tenant's own database", async () => {
    await runInTenant(tenantA, () => createPost("u", "A"));
    await runInTenant(tenantB, () => createPost("u", "B"));
    const titlesA = await manager.runWithTenant(tenantA, () =>
      tenancy.run(async (scope) => {
        const result = await scope
          .unrestricted()
          .rawQuery("select title from posts where id = ?", ["u"]);
        return (result.rows as { title: string }[]).map((row) => row.title);
      }),
    );
    expect(titlesA).toEqual(["A"]); // never tenant B's colliding row
    const joinB = await manager.runWithTenant(tenantB, () =>
      tenancy.run(async (scope) => {
        const result = await scope
          .unrestricted()
          .rawQuery(
            "select p1.title from posts p1 join posts p2 on p1.id = p2.id where p1.id = ?",
            ["u"],
          );
        return (result.rows as { title: string }[]).map((row) => row.title);
      }),
    );
    expect(joinB).toEqual(["B"]);
  });

  it("reports database-enforced capabilities for database-per-tenant", () => {
    expect(tenancy.capabilities.nestedReads).toBe("supported");
    expect(tenancy.capabilities.nestedWrites).toBe("supported");
    expect(tenancy.capabilities.rawQueries).toBe("supported");
  });

  it("refuses unrestricted() in central mode — it runs on the shared connection", async () => {
    // Central mode uses the shared base connection, not a leased tenant database,
    // so the raw handle must stay fail-closed (ADR-0033).
    await expect(
      manager.runInCentralContext(() =>
        tenancy.run(async (scope) => scope.unrestricted()),
      ),
    ).rejects.toBeInstanceOf(LucidTenancyConfigurationError);
  });
});
