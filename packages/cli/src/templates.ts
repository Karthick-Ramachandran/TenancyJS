export const EXPRESS_PRISMA_TEMPLATES = Object.freeze([
  Object.freeze({
    path: "tenancy.config.ts",
    content: `import { defineConfig } from "tenancyjs-core";

export default defineConfig({
  strategy: "rowLevel",
  framework: "express",
  orm: "prisma",
});
`,
  }),
  Object.freeze({
    path: "src/tenancy/register.ts",
    content: `import { createPrismaTenancyExtension } from "tenancyjs-adapter-prisma";
import type { TenancyManager } from "tenancyjs-core";

export function createTenancyExtension(manager: TenancyManager) {
  return createPrismaTenancyExtension({
    manager,
    // Classify every Prisma model before using the secured client.
    tenantModels: {},
    centralModels: {},
  });
}
`,
  }),
  Object.freeze({
    path: "src/middleware/tenancy.ts",
    content: `import type { TenancyManager, TenantRecord } from "tenancyjs-core";
import type { TenantResolutionChain } from "tenancyjs-identifiers";
import { createExpressTenancyMiddleware } from "tenancyjs-integration-express";

export function createTenancyMiddleware<TTenant extends TenantRecord>(
  manager: TenancyManager<TTenant>,
  resolver: TenantResolutionChain<TTenant>,
) {
  return createExpressTenancyMiddleware({ manager, resolver });
}
`,
  }),
]);

export const ADONIS_LUCID_TEMPLATES = Object.freeze([
  Object.freeze({
    path: "config/tenancy.ts",
    content: `import db from "@adonisjs/lucid/services/db";
import { TenancyManager } from "tenancyjs-core";
import { createLucidTenancy } from "tenancyjs-adapter-lucid";
import {
  HeaderTenantResolver,
  TenantResolutionChain,
} from "tenancyjs-identifiers";
import { defineAdonisTenancyConfig } from "tenancyjs-integration-adonis";

// TODO: import your tenant-scoped Lucid models.
// import Post from "#models/post";

export interface Tenant {
  id: string;
  name: string;
}

const manager = new TenancyManager<Tenant>();

// TODO: resolve tenants from your own store. TenancyJS only propagates identity.
const resolver = new TenantResolutionChain<Tenant>({
  resolvers: [new HeaderTenantResolver({ headerName: "x-tenant-id" })],
  store: {
    async find() {
      // return [{ tenant: { id, name }, status: "active" }];
      return [];
    },
  },
});

// The Lucid service is a factory: AdonisJS loads config before providers boot,
// so the provider resolves it once the Lucid provider is ready.
//
// Before serving traffic, add a migration that creates a non-privileged runtime
// role and enables + FORCES PostgreSQL row-level security on each tenant table,
// then connect the application as that role.
export default defineAdonisTenancyConfig<Tenant>({
  manager,
  resolver,
  tenancy: () =>
    createLucidTenancy<Tenant>({
      manager,
      database: db,
      // TODO: register each tenant-scoped model with its forced-RLS policy name.
      tenantModels: [],
    }),
});
`,
  }),
  Object.freeze({
    path: "app/middleware/tenant_middleware.ts",
    content: `// Register the TenancyJS provider in adonisrc.ts, then apply this named
// middleware to tenant route groups only. Central routes omit it.
export { TenancyMiddleware as default } from "tenancyjs-integration-adonis";
`,
  }),
]);

export const NEXT_PRISMA_TEMPLATES = Object.freeze([
  Object.freeze({
    path: "tenancy.config.ts",
    content: `import { defineConfig } from "tenancyjs-core";

export default defineConfig({
  strategy: "rowLevel",
  framework: "next",
  orm: "prisma",
});
`,
  }),
  Object.freeze({
    path: "lib/tenancy/register.ts",
    content: `import { createPrismaTenancyExtension } from "tenancyjs-adapter-prisma";
import type { TenancyManager } from "tenancyjs-core";

export function createTenancyExtension(manager: TenancyManager) {
  return createPrismaTenancyExtension({
    manager,
    // Classify every Prisma model before using the secured client.
    tenantModels: {},
    centralModels: {},
  });
}
`,
  }),
  Object.freeze({
    path: "lib/tenancy/server.ts",
    content: `import type { TenancyManager, TenantRecord } from "tenancyjs-core";
import type { TenantResolutionChain } from "tenancyjs-identifiers";
import { createNextTenancy } from "tenancyjs-integration-next";

// Wire this once, then import it from Route Handlers and Server Actions.
// Do not run tenant-scoped database work inside a streamed response body.
export function createTenancy<TTenant extends TenantRecord>(
  manager: TenancyManager<TTenant>,
  resolver: TenantResolutionChain<TTenant>,
) {
  return createNextTenancy<TTenant>({ manager, resolver });
}
`,
  }),
]);
