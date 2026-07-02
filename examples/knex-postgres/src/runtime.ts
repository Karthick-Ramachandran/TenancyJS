import { createKnexTenancy } from "@tenancyjs/adapter-knex";
import { TenancyManager } from "@tenancyjs/core";
import knex from "knex";

export interface ExampleTenant {
  readonly id: string;
  readonly name: string;
}

export function createKnexPostgresRuntime(databaseUrl: string) {
  if (typeof databaseUrl !== "string" || databaseUrl.trim() === "") {
    throw new TypeError("A runtime DATABASE_URL is required.");
  }
  const base = knex({ client: "pg", connection: databaseUrl });
  const manager = new TenancyManager<ExampleTenant>();
  const tenancy = createKnexTenancy({
    manager,
    knex: base,
    tenantTables: {
      "knex_example.posts": { policyName: "posts_tenant_isolation" },
    },
    centralTables: { "knex_example.tenants": {} },
  });

  return Object.freeze({
    manager,
    tenancy,
    disconnect: () => base.destroy(),
  });
}
