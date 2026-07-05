import { TenancyManager } from "tenancyjs-core";
import {
  createPostgresStrategyEngine,
  type PostgresExecutor,
} from "tenancyjs-adapter-shared";
import knex, { type Knex } from "knex";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createKnexTenancy } from "../src/index.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describePostgres =
  databaseUrl === undefined ? describe.skip : describe.sequential;
const suffix = `${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
const schemaA = `dbe_a_${suffix}`;
const schemaB = `dbe_b_${suffix}`;
const centralSchema = `dbe_central_${suffix}`;
const roleA = `dbe_role_a_${suffix}`;
const roleB = `dbe_role_b_${suffix}`;
const runtimeRole = `dbe_runtime_${suffix}`;

interface RoleTenant {
  readonly id: string;
  readonly schema: string;
  readonly role: string;
}

function executor(client: Pick<Knex, "raw">): PostgresExecutor {
  return (sql, bindings) =>
    bindings === undefined ? client.raw(sql) : client.raw(sql, [...bindings]);
}

interface ConnectionState {
  readonly pid: number;
  readonly role_name: string;
  readonly search_path: string;
}

async function connectionState(
  client: Pick<Knex, "raw">,
): Promise<ConnectionState> {
  const result = await client.raw(
    "select pg_backend_pid() as pid, current_user as role_name, current_setting('search_path') as search_path",
  );
  return result.rows[0] as ConnectionState;
}

describePostgres(
  "Knex database-enforced schema-per-tenant (per-tenant role)",
  () => {
    let admin: Knex;
    let runtime: Knex;
    let manager: TenancyManager<RoleTenant>;

    beforeAll(async () => {
      admin = knex({ client: "pg", connection: databaseUrl! });
      for (const schema of [schemaA, schemaB]) {
        await admin.schema.createSchema(schema);
        await admin.schema.withSchema(schema).createTable("posts", (table) => {
          table.string("id").primary();
          table.string("title").notNullable();
        });
      }
      await admin.schema.createSchema(centralSchema);
      await admin.schema
        .withSchema(centralSchema)
        .createTable("tenants", (table) => {
          table.string("id").primary();
        });

      await admin.raw(`create role ${roleA} nologin nosuperuser nobypassrls`);
      await admin.raw(`create role ${roleB} nologin nosuperuser nobypassrls`);
      await admin.raw(`grant usage on schema ${schemaA} to ${roleA}`);
      await admin.raw(
        `grant select, insert, update, delete on ${schemaA}.posts to ${roleA}`,
      );
      await admin.raw(`grant usage on schema ${schemaB} to ${roleB}`);
      await admin.raw(
        `grant select, insert, update, delete on ${schemaB}.posts to ${roleB}`,
      );

      await admin.raw(
        `create role ${runtimeRole} login nosuperuser nobypassrls`,
      );
      await admin.raw(`grant ${roleA}, ${roleB} to ${runtimeRole}`);
      await admin.raw(
        `grant usage on schema ${centralSchema} to ${runtimeRole}`,
      );
      await admin.raw(
        `grant select on ${centralSchema}.tenants to ${runtimeRole}`,
      );

      const runtimeUrl = new URL(databaseUrl!);
      runtimeUrl.username = runtimeRole;
      runtimeUrl.password = "";
      runtime = knex({
        client: "pg",
        connection: runtimeUrl.toString(),
        // A single physical connection makes transaction-local state
        // reversion observable instead of merely likely.
        pool: { min: 0, max: 1 },
      });
      manager = new TenancyManager<RoleTenant>();
    });

    afterAll(async () => {
      await runtime?.destroy();
      if (admin !== undefined) {
        for (const schema of [schemaA, schemaB, centralSchema]) {
          await admin.schema.dropSchemaIfExists(schema, true);
        }
        for (const role of [runtimeRole, roleA, roleB]) {
          await admin.raw(`drop role if exists ${role}`);
        }
        await admin.destroy();
      }
    });

    const tenantA: RoleTenant = {
      id: "tenant-a",
      schema: schemaA,
      role: roleA,
    };
    const tenantB: RoleTenant = {
      id: "tenant-b",
      schema: schemaB,
      role: roleB,
    };

    it("runs the protected adapter under the tenant's restricted role", async () => {
      const tenancy = createKnexTenancy<RoleTenant>({
        manager,
        knex: runtime,
        strategy: "schemaPerTenant",
        schema: (tenant) => tenant.schema,
        role: (tenant) => tenant.role,
        centralSchema,
        tenantTables: { posts: {} },
        centralTables: { tenants: {} },
      });
      await expect(tenancy.validate()).resolves.toEqual({
        valid: true,
        issues: [],
      });

      const rows = await manager.runWithTenant(tenantA, () =>
        tenancy.run(async (client) => {
          await client.table("posts").insert({ id: "p1", title: "A" });
          return client.table("posts").select("id");
        }),
      );
      expect(rows).toEqual([{ id: "p1" }]);
      await admin.withSchema(schemaA).table("posts").delete();
    });

    it("the database blocks a raw cross-schema query for the restricted role", async () => {
      const engine = createPostgresStrategyEngine<RoleTenant>({
        codePrefix: "TENANCY_KNEX",
        adapterName: "Knex",
        resolveSchema: (tenant) => tenant.schema,
        resolveRole: (tenant) => tenant.role,
        centralSchema,
        tenantTables: ["posts"],
        centralTables: ["tenants"],
      });

      const trx = await runtime.transaction();
      try {
        await engine.applyContext(executor(trx), {
          mode: "tenant",
          tenant: tenantA,
        });
        const who = await trx.raw("select current_user as who");
        expect(who.rows[0].who).toBe(roleA);
        // Own schema reachable via search_path.
        await expect(trx.raw("select * from posts")).resolves.toBeDefined();
        // Cross-schema is refused by the database itself — the role has no
        // USAGE on the other tenant's schema, so even raw SQL cannot reach it.
        await expect(
          trx.raw(`select * from ${schemaB}.posts`),
        ).rejects.toThrow();
      } finally {
        await trx.rollback();
      }
    });

    it("reverts role and search_path before the pooled connection is reused", async () => {
      const engine = createPostgresStrategyEngine<RoleTenant>({
        codePrefix: "TENANCY_KNEX",
        adapterName: "Knex",
        resolveSchema: (tenant) => tenant.schema,
        resolveRole: (tenant) => tenant.role,
        centralSchema,
        tenantTables: ["posts"],
        centralTables: ["tenants"],
      });
      const baseline = await connectionState(runtime);

      for (const tenant of [tenantA, tenantB]) {
        let inside: ConnectionState | undefined;
        await runtime.transaction(async (transaction) => {
          await engine.applyContext(executor(transaction), {
            mode: "tenant",
            tenant,
          });
          inside = await connectionState(transaction);
        });
        expect(inside).toMatchObject({
          pid: baseline.pid,
          role_name: tenant.role,
          search_path: tenant.schema,
        });

        const after = await connectionState(runtime);
        expect(after).toEqual(baseline);
      }
    });
  },
);
