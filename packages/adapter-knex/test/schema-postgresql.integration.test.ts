import { TenancyManager, type MaybePromise } from "@tenancyjs/core";
import knex, { type Knex } from "knex";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  KnexTenancyConfigurationError,
  KnexUnsupportedOperationError,
  createKnexTenancy,
  type ProtectedKnexClient,
} from "../src/index.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describePostgres = databaseUrl === undefined ? describe.skip : describe;
const suffix = `${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
const tenantASchema = `knex_schema_a_${suffix}`;
const tenantBSchema = `knex_schema_b_${suffix}`;
const centralSchema = `knex_schema_central_${suffix}`;
const runtimeRole = `knex_schema_runtime_${suffix}`;

interface SchemaTenant {
  readonly id: string;
  readonly schema: string;
}

describePostgres("Knex PostgreSQL schema-per-tenant isolation", () => {
  let admin: Knex;
  let runtimeBase: Knex;
  let manager: TenancyManager<SchemaTenant>;
  let tenancy: ReturnType<typeof createKnexTenancy<SchemaTenant>>;

  beforeAll(async () => {
    admin = knex({ client: "pg", connection: databaseUrl! });
    await admin.raw(`create role ${runtimeRole} login nosuperuser nobypassrls`);
    for (const schema of [tenantASchema, tenantBSchema, centralSchema]) {
      await admin.schema.createSchema(schema);
    }
    for (const schema of [tenantASchema, tenantBSchema]) {
      await admin.schema.withSchema(schema).createTable("posts", (table) => {
        table.string("id").primary();
        table.string("title").notNullable();
      });
      await admin.raw(`grant usage on schema ${schema} to ${runtimeRole}`);
      await admin.raw(
        `grant select, insert, update, delete on ${schema}.posts to ${runtimeRole}`,
      );
    }
    await admin.schema
      .withSchema(centralSchema)
      .createTable("tenants", (table) => {
        table.string("id").primary();
        table.string("name").notNullable();
      });
    await admin.raw(`grant usage on schema ${centralSchema} to ${runtimeRole}`);
    await admin.raw(
      `grant select, insert, update, delete on ${centralSchema}.tenants to ${runtimeRole}`,
    );

    const runtimeUrl = new URL(databaseUrl!);
    runtimeUrl.username = runtimeRole;
    runtimeUrl.password = "";
    runtimeBase = knex({
      client: "pg",
      connection: runtimeUrl.toString(),
      pool: { min: 0, max: 4 },
    });
    manager = new TenancyManager<SchemaTenant>();
    tenancy = createKnexTenancy({
      manager,
      knex: runtimeBase,
      strategy: "schemaPerTenant",
      schema: (tenant) => tenant.schema,
      centralSchema,
      tenantTables: { posts: {} },
      centralTables: { tenants: {} },
    });
  });

  beforeEach(async () => {
    for (const schema of [tenantASchema, tenantBSchema]) {
      await admin.withSchema(schema).table("posts").delete();
    }
    await admin.withSchema(centralSchema).table("tenants").delete();
    await admin.withSchema(tenantASchema).table("posts").insert({
      id: "post-a",
      title: "A",
    });
    await admin.withSchema(tenantBSchema).table("posts").insert({
      id: "post-b",
      title: "B",
    });
    await admin
      .withSchema(centralSchema)
      .table("tenants")
      .insert([
        { id: "tenant-a", name: "A" },
        { id: "tenant-b", name: "B" },
      ]);
    await expect(tenancy.validate()).resolves.toEqual({
      valid: true,
      issues: [],
    });
  });

  afterAll(async () => {
    await runtimeBase?.destroy();
    if (admin !== undefined) {
      for (const schema of [tenantASchema, tenantBSchema, centralSchema]) {
        await admin.schema.dropSchemaIfExists(schema, true);
      }
      await admin.raw(`drop role if exists ${runtimeRole}`);
      await admin.destroy();
    }
  });

  it("isolates concurrent unqualified reads and writes without tenant columns", async () => {
    const [tenantA, tenantB] = await Promise.all([
      withTenant("tenant-a", tenantASchema, async (db) => {
        await db.table("posts").insert({ id: "created-a", title: "Created" });
        expect(
          await db
            .table("posts")
            .where("id", "created-a")
            .update({ title: "Updated" }),
        ).toBe(1);
        await db.table("posts").insert({ id: "deleted-a", title: "Delete" });
        expect(await db.table("posts").where("id", "deleted-a").delete()).toBe(
          1,
        );
        expect(
          await db
            .table("posts")
            .where("id", "post-b")
            .update({ title: "stolen" }),
        ).toBe(0);
        expect(await db.table("posts").where("id", "post-b").delete()).toBe(0);
        return db.table("posts").orderBy("id").select("id");
      }),
      withTenant("tenant-b", tenantBSchema, (db) =>
        db.table("posts").orderBy("id").select("id"),
      ),
    ]);

    expect(tenantA).toEqual([{ id: "created-a" }, { id: "post-a" }]);
    expect(tenantB).toEqual([{ id: "post-b" }]);
    await expect(
      admin.withSchema(tenantBSchema).table("posts").where("id", "created-a"),
    ).resolves.toEqual([]);
    await expect(
      admin
        .withSchema(tenantBSchema)
        .table("posts")
        .where("id", "post-b")
        .first(),
    ).resolves.toMatchObject({ title: "B" });
  });

  it("rejects qualified, raw, and cross-placement protected access", async () => {
    await withTenant("tenant-a", tenantASchema, async (db) => {
      expect(() => db.table(`${tenantBSchema}.posts`)).toThrow(
        KnexTenancyConfigurationError,
      );
      expect(() => Reflect.get(db, "raw")).toThrow(
        KnexUnsupportedOperationError,
      );
      await expect(db.table("tenants").select("id")).rejects.toBeInstanceOf(
        KnexUnsupportedOperationError,
      );
    });
    await manager.runInCentralContext(() =>
      tenancy.run(async (db) => {
        await expect(db.table("posts").select("id")).rejects.toBeInstanceOf(
          KnexUnsupportedOperationError,
        );
        await expect(
          db.table("tenants").orderBy("id").select("id"),
        ).resolves.toEqual([{ id: "tenant-a" }, { id: "tenant-b" }]);
      }),
    );
  });

  it("rolls back failures and clears transaction-local search_path", async () => {
    const failure = new Error("rollback");
    await expect(
      withTenant("tenant-a", tenantASchema, async (db) => {
        await db
          .table("posts")
          .insert({ id: "rolled-back", title: "Rollback" });
        throw failure;
      }),
    ).rejects.toBe(failure);
    await expect(
      admin.withSchema(tenantASchema).table("posts").where("id", "rolled-back"),
    ).resolves.toEqual([]);

    await withTenant("tenant-a", tenantASchema, (db) =>
      db.table("posts").select("id"),
    );
    await withTenant("tenant-b", tenantBSchema, async (db) => {
      await expect(db.table("posts").select("id")).resolves.toEqual([
        { id: "post-b" },
      ]);
    });
    await expect(runtimeBase.table("posts").select("id")).rejects.toBeDefined();
  });

  function withTenant<TResult>(
    id: string,
    schema: string,
    callback: (db: ProtectedKnexClient) => MaybePromise<TResult>,
  ): Promise<TResult> {
    return manager.runWithTenant({ id, schema }, () => tenancy.run(callback));
  }
});
