import type { InitFramework, InitOrm, InitStrategy } from "./types.js";

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

const EXPRESS_MIDDLEWARE_TEMPLATE = Object.freeze({
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
});

// The ORM register wiring is framework-agnostic (Next.js server code is Express
// architecture + React), so it is shared across Express and Next scaffolds.
const SQL_ORM_REGISTER: Readonly<
  Record<"typeorm" | "sequelize" | "drizzle", string>
> = Object.freeze({
  typeorm: `import { createTypeOrmTenancy, type TypeOrmTenantEntityConfig } from "tenancyjs-adapter-typeorm";
import type { TenancyManager, TenantRecord } from "tenancyjs-core";
import type { DataSource } from "typeorm";

export function createTenancy<TTenant extends TenantRecord>(
  manager: TenancyManager<TTenant>,
  dataSource: DataSource,
  tenantEntities: readonly TypeOrmTenantEntityConfig[],
) {
  return createTypeOrmTenancy({ manager, dataSource, tenantEntities });
}
`,
  sequelize: `import { createSequelizeTenancy, type SequelizeTenantModelConfig } from "tenancyjs-adapter-sequelize";
import type { TenancyManager, TenantRecord } from "tenancyjs-core";
import type { Sequelize } from "sequelize";

export function createTenancy<TTenant extends TenantRecord>(
  manager: TenancyManager<TTenant>,
  sequelize: Sequelize,
  tenantModels: readonly SequelizeTenantModelConfig[],
) {
  return createSequelizeTenancy({ manager, sequelize, tenantModels });
}
`,
  drizzle: `import {
  createDrizzleTenancy,
  type DrizzleDatabaseBinding,
  type DrizzleTenantTableConfig,
} from "tenancyjs-adapter-drizzle";
import type { TenancyManager, TenantRecord } from "tenancyjs-core";

export function createTenancy<TTenant extends TenantRecord>(
  manager: TenancyManager<TTenant>,
  database: DrizzleDatabaseBinding,
  tenantTables: readonly DrizzleTenantTableConfig[],
) {
  // Build database with createPostgresDrizzleBinding or createMySqlDrizzleBinding.
  return createDrizzleTenancy({ manager, database, tenantTables });
}
`,
});

function sqlConfigContent(framework: "express" | "next", orm: string): string {
  return `import { defineConfig } from "tenancyjs-core";

export default defineConfig({
  strategy: "rowLevel",
  framework: "${framework}",
  orm: "${orm}",
});
`;
}

function expressOrmTemplates(orm: "typeorm" | "sequelize" | "drizzle") {
  return Object.freeze([
    Object.freeze({
      path: "tenancy.config.ts",
      content: sqlConfigContent("express", orm),
    }),
    Object.freeze({
      path: "src/tenancy/register.ts",
      content: SQL_ORM_REGISTER[orm],
    }),
    EXPRESS_MIDDLEWARE_TEMPLATE,
  ]);
}

export const EXPRESS_TYPEORM_TEMPLATES = expressOrmTemplates("typeorm");
export const EXPRESS_SEQUELIZE_TEMPLATES = expressOrmTemplates("sequelize");
export const EXPRESS_DRIZZLE_TEMPLATES = expressOrmTemplates("drizzle");

const ADONIS_MIDDLEWARE_TEMPLATE: Template = Object.freeze({
  path: "app/middleware/tenant_middleware.ts",
  content: `// Register the TenancyJS provider in adonisrc.ts, then apply this named
// middleware to tenant route groups only. Central routes omit it.
export { TenancyMiddleware as default } from "tenancyjs-integration-adonis";
`,
});

// Lucid supports all three strategies at runtime, so init scaffolds all three.
// The header (imports, Tenant, manager, resolver) is shared; only the
// `createLucidTenancy` options differ per strategy — using Lucid's real API.
function adonisLucidConfig(strategy: InitStrategy): string {
  const header = `import db from "@adonisjs/lucid/services/db";
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

`;
  const factoryNote =
    "// The Lucid service is a factory: AdonisJS loads config before providers boot,\n" +
    "// so the provider resolves it once the Lucid provider is ready.\n";

  let intro: string;
  let options: string;
  if (strategy === "schemaPerTenant") {
    intro = factoryNote;
    options = `      strategy: "schemaPerTenant",
      // Each tenant gets its own PostgreSQL schema (isolated via search_path).
      // Provision the schema before the tenant is first used.
      schema: (tenant) => \`tenant_\${tenant.id}\`,
      // TODO: register each tenant-scoped Lucid model.
      tenantModels: [],`;
  } else if (strategy === "databasePerTenant") {
    intro = factoryNote;
    options = `      strategy: "databasePerTenant",
      // Lease the tenant's own connection per scope; \`key\` must be unique per tenant.
      connection: (tenant) => ({
        key: tenant.id,
        create: () => {
          // TODO: build a Lucid { transaction, destroy } connection for the
          // tenant's own database.
          throw new Error(\`configure the connection for tenant \${tenant.id}\`);
        },
      }),
      // TODO: register each tenant-scoped Lucid model.
      tenantModels: [],`;
  } else {
    intro =
      factoryNote +
      "//\n" +
      "// Before serving traffic, add a migration that creates a non-privileged runtime\n" +
      "// role and enables + FORCES PostgreSQL row-level security on each tenant table,\n" +
      "// then connect the application as that role.\n";
    options = `      // TODO: register each tenant-scoped model with its forced-RLS policy name.
      tenantModels: [],`;
  }

  return `${header}${intro}export default defineAdonisTenancyConfig<Tenant>({
  manager,
  resolver,
  tenancy: () =>
    createLucidTenancy<Tenant>({
      manager,
      database: db,
${options}
    }),
});
`;
}

export const ADONIS_LUCID_TEMPLATES: TemplateSet = Object.freeze([
  Object.freeze({
    path: "config/tenancy.ts",
    content: adonisLucidConfig("rowLevel"),
  }),
  ADONIS_MIDDLEWARE_TEMPLATE,
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

// --- Strategy-aware scaffolds (schema-per-tenant, database-per-tenant) --------
//
// Row-level keeps the templates above unchanged. For the other two strategies we
// generate a strategy-specific config + register helper, using each adapter's
// real factory and option names (the CLI never invents an API). Combos we have
// not scaffolded yet return undefined so the caller can fail closed.

type Template = Readonly<{ path: string; content: string }>;
type TemplateSet = readonly Template[];

const NEXT_SERVER_TEMPLATE: Template = NEXT_PRISMA_TEMPLATES[2]!;

// Next.js server code is Express architecture + React, so it takes any SQL ORM.
function nextOrmTemplates(
  orm: "typeorm" | "sequelize" | "drizzle",
): TemplateSet {
  return Object.freeze([
    Object.freeze({
      path: "tenancy.config.ts",
      content: sqlConfigContent("next", orm),
    }),
    Object.freeze({
      path: "lib/tenancy/register.ts",
      content: SQL_ORM_REGISTER[orm],
    }),
    NEXT_SERVER_TEMPLATE,
  ]);
}

export const NEXT_TYPEORM_TEMPLATES = nextOrmTemplates("typeorm");
export const NEXT_SEQUELIZE_TEMPLATES = nextOrmTemplates("sequelize");
export const NEXT_DRIZZLE_TEMPLATES = nextOrmTemplates("drizzle");

interface SqlAdapterMeta {
  readonly factory: string;
  readonly importLine: string;
  readonly resourceType: string;
  readonly resourceImport: string;
  readonly resourceParam: string;
  readonly tenantParam: string;
  readonly tenantType: string;
}

const SQL_ADAPTERS: Readonly<
  Record<"sequelize" | "typeorm" | "drizzle", SqlAdapterMeta>
> = Object.freeze({
  sequelize: {
    factory: "createSequelizeTenancy",
    importLine: `import { createSequelizeTenancy, type SequelizeTenantModelConfig } from "tenancyjs-adapter-sequelize";`,
    resourceType: "Sequelize",
    resourceImport: `import type { Sequelize } from "sequelize";`,
    resourceParam: "sequelize",
    tenantParam: "tenantModels",
    tenantType: "readonly SequelizeTenantModelConfig[]",
  },
  typeorm: {
    factory: "createTypeOrmTenancy",
    importLine: `import { createTypeOrmTenancy, type TypeOrmTenantEntityConfig } from "tenancyjs-adapter-typeorm";`,
    resourceType: "DataSource",
    resourceImport: `import type { DataSource } from "typeorm";`,
    resourceParam: "dataSource",
    tenantParam: "tenantEntities",
    tenantType: "readonly TypeOrmTenantEntityConfig[]",
  },
  drizzle: {
    factory: "createDrizzleTenancy",
    importLine: `import {
  createDrizzleTenancy,
  type DrizzleDatabaseBinding,
  type DrizzleTenantTableConfig,
} from "tenancyjs-adapter-drizzle";`,
    resourceType: "DrizzleDatabaseBinding",
    resourceImport: "",
    resourceParam: "database",
    tenantParam: "tenantTables",
    tenantType: "readonly DrizzleTenantTableConfig[]",
  },
});

function strategyConfigContent(
  framework: InitFramework,
  orm: InitOrm,
  strategy: InitStrategy,
): string {
  return `import { defineConfig } from "tenancyjs-core";

export default defineConfig({
  strategy: "${strategy}",
  framework: "${framework}",
  orm: "${orm}",
});
`;
}

function sqlStrategyBlock(
  meta: SqlAdapterMeta,
  strategy: InitStrategy,
): string {
  if (strategy === "schemaPerTenant") {
    return `    strategy: "schemaPerTenant",
    // Each tenant gets its own PostgreSQL schema (isolated via search_path).
    schema: (tenant) => \`tenant_\${tenant.id}\`,
`;
  }
  return `    strategy: "databasePerTenant",
    // Lease the tenant's own ${meta.resourceType} per scope; \`key\` must be unique per tenant.
    connection: (tenant) => ({
      key: tenant.id,
      create: () => {
        // TODO: build a ${meta.resourceType} connected to the tenant's own database.
        throw new Error(\`configure the ${meta.resourceParam} for tenant \${tenant.id}\`);
      },
    }),
`;
}

function sqlRegisterContent(
  meta: SqlAdapterMeta,
  strategy: InitStrategy,
): string {
  const resourceImport =
    meta.resourceImport === "" ? "" : `\n${meta.resourceImport}`;
  return `${meta.importLine}
import type { TenancyManager, TenantRecord } from "tenancyjs-core";${resourceImport}

export function createTenancy<TTenant extends TenantRecord>(
  manager: TenancyManager<TTenant>,
  ${meta.resourceParam}: ${meta.resourceType},
  ${meta.tenantParam}: ${meta.tenantType},
) {
  return ${meta.factory}({
    manager,
    ${meta.resourceParam},
    ${meta.tenantParam},
${sqlStrategyBlock(meta, strategy)}  });
}
`;
}

function prismaRegisterContent(strategy: InitStrategy): string {
  const isSchema = strategy === "schemaPerTenant";
  const factory = isSchema
    ? "createPrismaSchemaTenancy"
    : "createPrismaDatabaseTenancy";
  const optionKey = isSchema ? "schema" : "connection";
  const note = isSchema
    ? "Each tenant is a PostgreSQL schema. Bind the client's driver adapter to it,\n// e.g. new PrismaClient({ adapter: new PrismaPg(url, { schema }) })."
    : "Each tenant has its own database. Build a PrismaClient connected to it.";
  return `import { ${factory} } from "tenancyjs-adapter-prisma";
import type { PrismaClient } from "@prisma/client";
import type { TenancyManager, TenantRecord } from "tenancyjs-core";

// ${note}
export function createTenancy<TTenant extends TenantRecord>(
  manager: TenancyManager<TTenant>,
) {
  return ${factory}<TTenant, PrismaClient>({
    manager,
    ${optionKey}: (tenant) => ({
      key: tenant.id,
      create: () => {
        // TODO: build the tenant's PrismaClient.
        throw new Error(\`configure the Prisma client for tenant \${tenant.id}\`);
      },
    }),
    disconnect: (client) => client.$disconnect(),
  });
}
`;
}

/**
 * Templates for schema-per-tenant / database-per-tenant. Returns undefined for
 * row-level (handled by the static map) and for any combo we have not scaffolded
 * yet, so the caller fails closed with a docs pointer rather than emitting a
 * half-right scaffold.
 */
export function resolveStrategyTemplates(
  framework: InitFramework,
  orm: InitOrm,
  strategy: InitStrategy,
): TemplateSet | undefined {
  if (strategy === "rowLevel") return undefined;
  // Lucid supports schema- and database-per-tenant at runtime, so scaffold them.
  if (framework === "adonis") {
    if (orm !== "lucid") return undefined;
    return Object.freeze([
      Object.freeze({
        path: "config/tenancy.ts",
        content: adonisLucidConfig(strategy),
      }),
      ADONIS_MIDDLEWARE_TEMPLATE,
    ]);
  }
  if (framework !== "express" && framework !== "next") return undefined;

  const config: Template = {
    path: "tenancy.config.ts",
    content: strategyConfigContent(framework, orm, strategy),
  };
  // Next.js uses lib/ + a server helper; Express uses src/ + middleware.
  const registerPath =
    framework === "next"
      ? "lib/tenancy/register.ts"
      : "src/tenancy/register.ts";
  const integration =
    framework === "next" ? NEXT_SERVER_TEMPLATE : EXPRESS_MIDDLEWARE_TEMPLATE;

  const register =
    orm === "prisma"
      ? prismaRegisterContent(strategy)
      : orm === "sequelize" || orm === "typeorm" || orm === "drizzle"
        ? sqlRegisterContent(SQL_ADAPTERS[orm], strategy)
        : undefined;
  if (register === undefined) return undefined;

  return Object.freeze([
    Object.freeze(config),
    Object.freeze({ path: registerPath, content: register }),
    integration,
  ]);
}

/**
 * Strategies `init` can scaffold for a stack. Always includes row-level; adds
 * schema-/database-per-tenant only where a scaffold exists (so the interactive
 * prompt never offers a strategy that would fail closed).
 */
export function scaffoldableStrategies(
  framework: InitFramework,
  orm: InitOrm,
): readonly InitStrategy[] {
  const strategies: InitStrategy[] = ["rowLevel"];
  for (const strategy of ["schemaPerTenant", "databasePerTenant"] as const) {
    if (resolveStrategyTemplates(framework, orm, strategy) !== undefined) {
      strategies.push(strategy);
    }
  }
  return strategies;
}
