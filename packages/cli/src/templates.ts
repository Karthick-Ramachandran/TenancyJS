export const EXPRESS_PRISMA_TEMPLATES = Object.freeze([
  Object.freeze({
    path: "tenancy.config.ts",
    content: `import { defineConfig } from "@tenancyjs/core";

export default defineConfig({
  strategy: "rowLevel",
  framework: "express",
  orm: "prisma",
});
`,
  }),
  Object.freeze({
    path: "src/tenancy/register.ts",
    content: `import { createPrismaTenancyExtension } from "@tenancyjs/adapter-prisma";
import type { TenancyManager } from "@tenancyjs/core";

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
    content: `import type { TenancyManager, TenantRecord } from "@tenancyjs/core";
import type { TenantResolutionChain } from "@tenancyjs/identifiers";
import { createExpressTenancyMiddleware } from "@tenancyjs/integration-express";

export function createTenancyMiddleware<TTenant extends TenantRecord>(
  manager: TenancyManager<TTenant>,
  resolver: TenantResolutionChain<TTenant>,
) {
  return createExpressTenancyMiddleware({ manager, resolver });
}
`,
  }),
]);
