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

// database-per-tenant is the one Lucid strategy that is dialect-agnostic — it
// isolates purely by routing each tenant scope to its own leased connection, with
// no Postgres RLS or search_path. This proves it holds on MySQL too (experimental).
const databaseUrl = process.env.MYSQL_TEST_DATABASE_URL;
const describeMysql =
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

// Lucid's MysqlConfig wants a connection object (unlike PostgreConfig, which
// accepts a URL string). Parse the test URL into one.
function mysqlConn(database?: string) {
  const url = new URL(databaseUrl!);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ...(database ? { database } : {}),
  };
}

async function withConnection<TResult>(
  database: string,
  callback: (client: Knex) => Promise<TResult>,
): Promise<TResult> {
  const client = knex({ client: "mysql2", connection: urlFor(database) });
  try {
    return await callback(client);
  } finally {
    await client.destroy();
  }
}

describeMysql("Lucid MySQL database-per-tenant isolation", () => {
  let admin: Knex;
  let database: Database;
  let manager: TenancyManager<DatabaseTenant>;
  let tenancy: ReturnType<typeof createLucidTenancy<DatabaseTenant>>;

  beforeAll(async () => {
    admin = knex({ client: "mysql2", connection: databaseUrl! });
    for (const name of [databaseA, databaseB]) {
      await admin.raw(`create database \`${name}\``);
      await withConnection(name, async (client) =>
        client.schema.createTable("posts", (table) => {
          table.string("id").primary();
          table.string("title").notNullable();
        }),
      );
    }

    database = new Database(
      {
        connection: "mysql",
        connections: {
          mysql: {
            client: "mysql2",
            connection: mysqlConn(
              new URL(databaseUrl!).pathname.replace(/^\//, "") || undefined,
            ),
            pool: { min: 0, max: 2 },
          },
          [connectionA]: {
            client: "mysql2",
            connection: mysqlConn(databaseA),
            pool: { min: 0, max: 2 },
          },
          [connectionB]: {
            client: "mysql2",
            connection: mysqlConn(databaseB),
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
      await admin.raw(`drop database if exists \`${databaseA}\``);
      await admin.raw(`drop database if exists \`${databaseB}\``);
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

    // Adversarial: mutate the colliding primary key through tenant A and prove
    // tenant B's copy is untouched.
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

  // ADR-0033: scope.unrestricted() hands back the tenant's own leased
  // transaction, so raw access and joins can't cross tenants — on MySQL too.
  it("unrestricted() stays inside the tenant's own database", async () => {
    await runInTenant(tenantA, () => createPost("u", "A"));
    await runInTenant(tenantB, () => createPost("u", "B"));
    const titlesA = await manager.runWithTenant(tenantA, () =>
      tenancy.run(async (scope) => {
        const rows = await scope
          .unrestricted()
          .from("posts")
          .where("id", "u")
          .select("title");
        return (rows as { title: string }[]).map((row) => row.title);
      }),
    );
    expect(titlesA).toEqual(["A"]); // never tenant B's colliding row
    const joinB = await manager.runWithTenant(tenantB, () =>
      tenancy.run(async (scope) => {
        const rows = await scope
          .unrestricted()
          .from("posts as p1")
          .join("posts as p2", "p1.id", "p2.id")
          .where("p1.id", "u")
          .select("p1.title as title");
        return (rows as { title: string }[]).map((row) => row.title);
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
    await expect(
      manager.runInCentralContext(() =>
        tenancy.run(async (scope) => scope.unrestricted()),
      ),
    ).rejects.toBeInstanceOf(LucidTenancyConfigurationError);
  });
});
