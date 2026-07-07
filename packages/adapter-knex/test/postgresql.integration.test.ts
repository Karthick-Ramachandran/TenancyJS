import { TenancyManager, type MaybePromise } from "tenancyjs-core";
import knex, { type Knex } from "knex";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  KnexTenancyConfigurationError,
  KnexTenantFieldConflictError,
  createKnexTenancy,
  type ProtectedKnexClient,
} from "../src/index.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describePostgres = databaseUrl === undefined ? describe.skip : describe;
const suffix = `${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
const schema = `knex_tenancy_${suffix}`;
const runtimeRole = `knex_runtime_${suffix}`;
const postsTable = `${schema}.posts`;
const tenantsTable = `${schema}.tenants`;
const policyName = "posts_tenant_isolation";

interface TestTenant {
  readonly id: string;
  readonly name: string;
}

describePostgres("Knex PostgreSQL row-level isolation", () => {
  let admin: Knex;
  let runtimeBase: Knex;
  let manager: TenancyManager<TestTenant>;
  let tenancy: ReturnType<typeof createKnexTenancy<TestTenant>>;

  beforeAll(async () => {
    admin = knex({ client: "pg", connection: databaseUrl! });
    await admin.raw(
      `create role ${runtimeRole} nologin nosuperuser nobypassrls`,
    );
    await admin.raw(`alter role ${runtimeRole} login`);
    await admin.schema.createSchema(schema);
    await admin.schema.withSchema(schema).createTable("tenants", (table) => {
      table.string("id").primary();
      table.string("name").notNullable();
    });
    await admin.schema.withSchema(schema).createTable("posts", (table) => {
      table.string("id").primary();
      table.string("tenant_id").notNullable().index();
      table.string("title").notNullable();
      table.integer("score").notNullable().defaultTo(0);
    });
    await admin.raw(`alter table ${postsTable} enable row level security`);
    await admin.raw(`alter table ${postsTable} force row level security`);
    await admin.raw(`
      create policy ${policyName} on ${postsTable}
      using (
        current_setting('tenancyjs.is_central', true) = 'true'
        or tenant_id = nullif(current_setting('tenancyjs.tenant_id', true), '')
      )
      with check (
        current_setting('tenancyjs.is_central', true) = 'true'
        or tenant_id = nullif(current_setting('tenancyjs.tenant_id', true), '')
      )
    `);
    await admin.raw(`grant usage on schema ${schema} to ${runtimeRole}`);
    await admin.raw(
      `grant select, insert, update, delete on ${postsTable} to ${runtimeRole}`,
    );
    await admin.raw(
      `grant select, insert, update, delete on ${tenantsTable} to ${runtimeRole}`,
    );

    const runtimeUrl = new URL(databaseUrl!);
    runtimeUrl.username = runtimeRole;
    runtimeUrl.password = "";
    runtimeBase = knex({
      client: "pg",
      connection: runtimeUrl.toString(),
      pool: { min: 0, max: 4 },
    });
    manager = new TenancyManager<TestTenant>();
    tenancy = createKnexTenancy({
      manager,
      knex: runtimeBase,
      tenantTables: {
        [postsTable]: { policyName },
      },
      centralTables: { [tenantsTable]: {} },
    });
  });

  beforeEach(async () => {
    await admin(tenantsTable).delete();
    await admin(postsTable).delete();
    await admin(tenantsTable).insert([
      { id: "tenant-a", name: "Tenant A" },
      { id: "tenant-b", name: "Tenant B" },
    ]);
    await admin(postsTable).insert([
      { id: "post-a", tenant_id: "tenant-a", title: "A", score: 10 },
      { id: "post-b", tenant_id: "tenant-b", title: "B", score: 20 },
    ]);
    await expect(tenancy.validate()).resolves.toEqual({
      valid: true,
      issues: [],
    });
  });

  afterAll(async () => {
    await runtimeBase?.destroy();
    if (admin !== undefined) {
      await admin.schema.dropSchemaIfExists(schema, true);
      await admin.raw(`drop role if exists ${runtimeRole}`);
      await admin.destroy();
    }
  });

  it("isolates reads, counts, and aggregates for concurrent tenants", async () => {
    const [tenantA, tenantB] = await Promise.all([
      withTenant("tenant-a", (db) =>
        Promise.all([
          db.table(postsTable).select("id", "tenant_id"),
          db.table(postsTable).count(),
          db.table(postsTable).sum("score"),
        ]),
      ),
      withTenant("tenant-b", (db) =>
        db.table(postsTable).select("id", "tenant_id"),
      ),
    ]);

    expect(tenantA[0]).toEqual([{ id: "post-a", tenant_id: "tenant-a" }]);
    expect(tenantA[1]).toEqual([{ count: "1" }]);
    expect(tenantA[2]).toEqual([{ sum: "10" }]);
    expect(tenantB).toEqual([{ id: "post-b", tenant_id: "tenant-b" }]);
  });

  it("injects tenant ownership and prevents cross-tenant mutation", async () => {
    await withTenant("tenant-a", async (db) => {
      await db
        .table(postsTable)
        .insert({ id: "post-created", title: "Created", score: 1 });
      const updated = await db
        .table(postsTable)
        .where("id", "post-b")
        .update({ title: "stolen" });
      const deleted = await db.table(postsTable).where("id", "post-b").delete();
      expect(updated).toBe(0);
      expect(deleted).toBe(0);
      await expect(
        db
          .table(postsTable)
          .insert({ id: "bad", tenant_id: "tenant-b", title: "Bad", score: 0 }),
      ).rejects.toBeInstanceOf(KnexTenantFieldConflictError);
    });

    await expect(
      admin(postsTable).where({ id: "post-created" }).first(),
    ).resolves.toMatchObject({
      tenant_id: "tenant-a",
    });
    await expect(
      admin(postsTable).where({ id: "post-b" }).first(),
    ).resolves.toMatchObject({
      title: "B",
    });
  });

  it("commits nested savepoints and rolls back failed managed transactions", async () => {
    await withTenant("tenant-a", (db) =>
      db.transaction((nested) =>
        nested
          .table(postsTable)
          .insert({ id: "nested", title: "Nested", score: 2 }),
      ),
    );
    await expect(
      admin(postsTable).where({ id: "nested" }).first(),
    ).resolves.toBeDefined();

    const failure = new Error("rollback");
    await expect(
      withTenant("tenant-a", async (db) => {
        await db
          .table(postsTable)
          .insert({ id: "rolled-back", title: "Rollback", score: 3 });
        throw failure;
      }),
    ).rejects.toBe(failure);
    await expect(
      admin(postsTable).where({ id: "rolled-back" }).first(),
    ).resolves.toBeUndefined();
  });

  it("allows explicit central context while direct runtime access has no tenant setting", async () => {
    const allPosts = await manager.runInCentralContext(() =>
      tenancy.run((db) => db.table(postsTable).orderBy("id").select("id")),
    );
    expect(allPosts).toEqual([{ id: "post-a" }, { id: "post-b" }]);

    await expect(runtimeBase(postsTable).select("id")).resolves.toEqual([]);
    await expect(
      withTenant("tenant-a", (db) => db.table(tenantsTable).select("id")),
    ).resolves.toEqual([{ id: "tenant-a" }, { id: "tenant-b" }]);
  });

  it("does not leak transaction-local identity through the connection pool", async () => {
    await withTenant("tenant-a", (db) => db.table(postsTable).select("id"));
    await withTenant("tenant-b", async (db) => {
      const rows = await db.table(postsTable).select("id");
      expect(rows).toEqual([{ id: "post-b" }]);
    });
    await expect(runtimeBase(postsTable).select("id")).resolves.toEqual([]);
  });

  // ADR-0038: forced-RLS row-level is database-enforced, so unrestricted() raw
  // SQL is allowed - and the validated policy under a non-BYPASSRLS role binds it
  // to the current tenant even though every tenant shares one table.
  it("allows unrestricted() raw SQL under forced RLS, bound to the tenant (ADR-0038)", async () => {
    const idsA = await withTenant("tenant-a", async (db) => {
      // The returned Knex.Transaction holds the SET LOCAL tenant GUC.
      const result = await db
        .unrestricted()
        .raw(`select id from ${postsTable}`);
      return (result.rows as { id: string }[]).map((row) => row.id);
    });
    expect(idsA).toEqual(["post-a"]); // never post-b, even via raw SQL
  });

  it("still refuses unrestricted() in central mode on row-level", async () => {
    // Central mode is cross-tenant by design and stays facade-enforced.
    await expect(
      manager.runInCentralContext(() =>
        tenancy.run(async (db) => db.unrestricted()),
      ),
    ).rejects.toBeInstanceOf(KnexTenancyConfigurationError);
  });

  function withTenant<TResult>(
    id: string,
    callback: (db: ProtectedKnexClient) => MaybePromise<TResult>,
  ): Promise<TResult> {
    return manager.runWithTenant({ id, name: id }, () => tenancy.run(callback));
  }
});
