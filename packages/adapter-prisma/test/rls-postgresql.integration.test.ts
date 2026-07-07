import { PrismaPg } from "@prisma/adapter-pg";
import { TenancyManager, TenantContextError } from "tenancyjs-core";
import knex, { type Knex } from "knex";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaClient } from "../../../.artifacts/prisma/adapter-prisma/client.js";
import { createPrismaRowLevelTenancy } from "../src/index.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describePostgres =
  databaseUrl === undefined ? describe.skip : describe.sequential;
const suffix = `${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
const runtimeRole = `prisma_rls_role_${suffix}`;

interface Tenant {
  readonly id: string;
}

// Uses a dedicated RlsPost table so its forced-RLS state and restricted role
// never contend with the facade tests that share Post.
describePostgres("Prisma RLS-backed row-level isolation (ADR-0037)", () => {
  const manager = new TenancyManager<Tenant>();
  let admin: Knex;
  let base: PrismaClient;
  let tenancy: ReturnType<
    typeof createPrismaRowLevelTenancy<Tenant, PrismaClient>
  >;

  beforeAll(async () => {
    admin = knex({ client: "pg", connection: databaseUrl! });
    await admin.schema.dropTableIfExists("RlsPost");
    await admin.schema.createTable("RlsPost", (table) => {
      table.text("id").primary();
      table.text("tenantId").notNullable();
      table.text("title").notNullable();
      table.boolean("published").notNullable().defaultTo(false);
    });
    await admin.raw('alter table "RlsPost" enable row level security');
    await admin.raw('alter table "RlsPost" force row level security');
    await admin.raw(`
      create policy "RlsPost_tenant_isolation" on "RlsPost"
      using (
        current_setting('tenancyjs.is_central', true) = 'true'
        or "tenantId" = nullif(current_setting('tenancyjs.tenant_id', true), '')
      )
      with check (
        current_setting('tenancyjs.is_central', true) = 'true'
        or "tenantId" = nullif(current_setting('tenancyjs.tenant_id', true), '')
      )
    `);
    await admin.raw(`drop role if exists ${runtimeRole}`);
    await admin.raw(`create role ${runtimeRole} login nosuperuser nobypassrls`);
    await admin.raw(
      `grant select, insert, update, delete on "RlsPost" to ${runtimeRole}`,
    );

    const runtimeUrl = new URL(databaseUrl!);
    runtimeUrl.username = runtimeRole;
    runtimeUrl.password = "";
    base = new PrismaClient({
      adapter: new PrismaPg({ connectionString: runtimeUrl.toString() }),
    });
    tenancy = createPrismaRowLevelTenancy<Tenant, PrismaClient>({
      manager,
      client: base,
      tables: [
        {
          model: "RlsPost",
          table: "RlsPost",
          tenantColumn: "tenantId",
          tenantField: "tenantId",
        },
      ],
    });
  });

  beforeEach(async () => {
    await admin("RlsPost").delete();
    await expect(tenancy.validate()).resolves.toMatchObject({ valid: true });
  });

  afterAll(async () => {
    await base?.$disconnect();
    if (admin !== undefined) {
      await admin.schema.dropTableIfExists("RlsPost").catch(() => undefined);
      await admin
        .raw(`drop role if exists ${runtimeRole}`)
        .catch(() => undefined);
      await admin.destroy();
    }
  });

  const tenantA: Tenant = { id: "tenant-a" };
  const tenantB: Tenant = { id: "tenant-b" };
  const run = <TResult>(
    tenant: Tenant,
    callback: (tx: PrismaClient) => Promise<TResult>,
  ): Promise<TResult> =>
    manager.runWithTenant(tenant, () => tenancy.run(callback));

  it("isolates model reads and raw SQL under RLS", async () => {
    await run(tenantA, (tx) =>
      tx.rlsPost.create({
        data: { id: "post-a", title: "A", tenantId: "tenant-a" },
      }),
    );
    await run(tenantB, (tx) =>
      tx.rlsPost.create({
        data: { id: "post-b", title: "B", tenantId: "tenant-b" },
      }),
    );

    const aTitles = await run(tenantA, (tx) => tx.rlsPost.findMany());
    expect(aTitles.map((post) => post.title)).toEqual(["A"]);
    const bTitles = await run(tenantB, (tx) => tx.rlsPost.findMany());
    expect(bTitles.map((post) => post.title)).toEqual(["B"]);

    // Raw SQL runs under the SET LOCAL tenant GUC - the policy binds it to A.
    const rawA = await run(tenantA, async (tx) => {
      const rows = (await tx.$queryRawUnsafe(
        'select title from "RlsPost"',
      )) as { title: string }[];
      return rows.map((row) => row.title);
    });
    expect(rawA).toEqual(["A"]); // never tenant B's row, even via raw SQL
  });

  it("forces the tenant on write, overriding a spoofed discriminator", async () => {
    await run(tenantA, (tx) =>
      tx.rlsPost.create({
        data: { id: "spoof", title: "x", tenantId: "tenant-b" },
      }),
    );
    const row = (await admin("RlsPost").where({ id: "spoof" }).first()) as {
      tenantId: string;
    };
    expect(row.tenantId).toBe("tenant-a");
  });

  it("RLS WITH CHECK rejects a raw cross-tenant insert (the DB backstop)", async () => {
    // Raw SQL bypasses the facade injection, so the database policy is the last
    // line of defense: inserting another tenant's row must be refused.
    await expect(
      run(tenantA, (tx) =>
        tx.$executeRawUnsafe(
          'insert into "RlsPost" (id, "tenantId", title, published) values ($1, $2, $3, false)',
          "raw-x",
          "tenant-b",
          "x",
        ),
      ),
    ).rejects.toThrow();
  });

  it("fails closed without a tenant scope", async () => {
    await expect(tenancy.run(async () => undefined)).rejects.toBeInstanceOf(
      TenantContextError,
    );
  });

  it("refuses run() before validate() passes", async () => {
    const unvalidated = createPrismaRowLevelTenancy<Tenant, PrismaClient>({
      manager,
      client: base,
      tables: [
        { model: "RlsPost", table: "RlsPost", tenantColumn: "tenantId" },
      ],
    });
    await expect(
      manager.runWithTenant(tenantA, () =>
        unvalidated.run(async () => undefined),
      ),
    ).rejects.toThrow(/validate/);
  });
});
