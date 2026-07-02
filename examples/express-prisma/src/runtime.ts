import { PrismaPg } from "@prisma/adapter-pg";
import { createPrismaTenancyExtension } from "@tenancyjs/adapter-prisma";
import { TenancyManager } from "@tenancyjs/core";
import {
  HeaderTenantResolver,
  TenantResolutionChain,
} from "@tenancyjs/identifiers";

import { PrismaClient } from "./generated/prisma/client.js";

export interface ExampleTenant {
  readonly id: string;
  readonly name: string;
}

export function createProtectedPrismaClient(
  base: PrismaClient,
  manager: TenancyManager<ExampleTenant>,
) {
  return base.$extends(
    createPrismaTenancyExtension({
      manager,
      tenantModels: { Post: {} },
      centralModels: { Tenant: {} },
    }),
  );
}

export function createExampleRuntime(databaseUrl: string) {
  const manager = new TenancyManager<ExampleTenant>();
  const base = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  const prisma = createProtectedPrismaClient(base, manager);
  const resolver = new TenantResolutionChain<ExampleTenant>({
    resolvers: [new HeaderTenantResolver()],
    store: {
      async find(identifier) {
        const tenants = await prisma.tenant.findMany({
          where: { id: identifier.value },
        });
        return tenants.map((tenant) => ({ tenant, status: "active" as const }));
      },
    },
  });

  return Object.freeze({
    manager,
    prisma,
    resolver,
    disconnect: () => base.$disconnect(),
  });
}
