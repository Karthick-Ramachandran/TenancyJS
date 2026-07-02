import { PrismaPg } from "@prisma/adapter-pg";
import { createPrismaTenancyExtension } from "@tenancyjs/adapter-prisma";
import { TenancyManager } from "@tenancyjs/core";
import {
  HeaderTenantResolver,
  TenantResolutionChain,
} from "@tenancyjs/identifiers";
import { createNextTenancy } from "@tenancyjs/integration-next";

import { PrismaClient } from "../generated/prisma/client";

export interface ExampleTenant {
  readonly id: string;
  readonly name: string;
  readonly suspended: boolean;
}

function createRuntime() {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl.trim() === "") {
    throw new Error("DATABASE_URL is required.");
  }

  const manager = new TenancyManager<ExampleTenant>();
  const base = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  const prisma = base.$extends(
    createPrismaTenancyExtension({
      manager,
      tenantModels: { Post: {} },
      centralModels: { Tenant: {} },
    }),
  );
  const resolver = new TenantResolutionChain<ExampleTenant>({
    resolvers: [new HeaderTenantResolver()],
    store: {
      async find(identifier) {
        const matches = await prisma.tenant.findMany({
          where: { id: identifier.value },
        });
        return matches.map((tenant) => ({
          tenant,
          status: tenant.suspended
            ? ("suspended" as const)
            : ("active" as const),
        }));
      },
    },
  });
  const tenancy = createNextTenancy({ manager, resolver });
  return Object.freeze({ manager, prisma, resolver, tenancy });
}

declare global {
  var tenancyJsNextRuntime: ReturnType<typeof createRuntime> | undefined;
}

export function getRuntime(): ReturnType<typeof createRuntime> {
  const runtime = globalThis.tenancyJsNextRuntime ?? createRuntime();
  globalThis.tenancyJsNextRuntime = runtime;
  return runtime;
}
