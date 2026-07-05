import type { TenancyManager, TenantRecord } from "tenancyjs-core";
import { assertSqlIdentifier } from "tenancyjs-adapter-shared";

import type {
  DrizzleDatabaseBinding,
  DrizzleTableMetadata,
} from "./binding.js";
import { DrizzleTenancyConfigurationError } from "./errors.js";
import type {
  DrizzleCentralTableConfig,
  DrizzleTable,
  DrizzleTenantTableConfig,
} from "./types.js";

const DEFAULT_MAX_CONNECTIONS = 25;

export interface DrizzleDatabasePlacement {
  readonly key: string;
  readonly create: () =>
    DrizzleDatabaseBinding | Promise<DrizzleDatabaseBinding>;
}

export interface DrizzleTenancyOptions<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly manager: TenancyManager<TTenant>;
  readonly database: DrizzleDatabaseBinding;
  readonly tenantTables: readonly DrizzleTenantTableConfig[];
  readonly centralTables?: readonly DrizzleCentralTableConfig[];
  readonly strategy?: "rowLevel" | "schemaPerTenant" | "databasePerTenant";
  readonly schema?: (tenant: TTenant) => string;
  readonly centralSchema?: string;
  readonly role?: (tenant: TTenant) => string;
  readonly connection?: (tenant: TTenant) => DrizzleDatabasePlacement;
  readonly maxConnections?: number;
}

export interface NormalizedDrizzleTenantTableConfig extends DrizzleTableMetadata {
  readonly table: DrizzleTable;
  readonly qualifiedName: string;
  readonly tenantProperty: string;
  readonly tenantColumn: string;
  readonly policyName: string;
}

export type DrizzleTablePolicy =
  | Readonly<{ kind: "tenant"; config: NormalizedDrizzleTenantTableConfig }>
  | Readonly<{ kind: "central"; table: DrizzleTable }>;

export interface DrizzleTenancyConfig<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly manager: TenancyManager<TTenant>;
  readonly database: DrizzleDatabaseBinding;
  readonly strategy: "rowLevel" | "schemaPerTenant" | "databasePerTenant";
  readonly schema: ((tenant: TTenant) => string) | undefined;
  readonly centralSchema: string;
  readonly role: ((tenant: TTenant) => string) | undefined;
  readonly connection:
    ((tenant: TTenant) => DrizzleDatabasePlacement) | undefined;
  readonly maxConnections: number;
  readonly tenantTables: readonly Readonly<NormalizedDrizzleTenantTableConfig>[];
  classify(table: DrizzleTable): DrizzleTablePolicy | undefined;
}

export function defineDrizzleTenancyConfig<
  TTenant extends TenantRecord = TenantRecord,
>(options: DrizzleTenancyOptions<TTenant>): DrizzleTenancyConfig<TTenant> {
  if (options === null || typeof options !== "object")
    configuration("options are required");
  if (typeof options.manager?.getContext !== "function")
    configuration("requires a TenancyManager");
  if (typeof options.database?.transaction !== "function")
    configuration("requires a Drizzle database binding");
  const strategy = options.strategy ?? "rowLevel";
  if (
    strategy !== "rowLevel" &&
    strategy !== "schemaPerTenant" &&
    strategy !== "databasePerTenant"
  )
    configuration(
      "strategy must be rowLevel, schemaPerTenant, or databasePerTenant",
    );
  if (
    strategy === "schemaPerTenant" &&
    options.database.dialect !== "postgresql"
  )
    configuration(
      "schema-per-tenant is PostgreSQL-only; use database-per-tenant for MySQL",
    );
  if (strategy === "schemaPerTenant" && typeof options.schema !== "function")
    configuration("schema-per-tenant requires a schema resolver");
  if (strategy !== "schemaPerTenant" && options.schema !== undefined)
    configuration("only schema-per-tenant accepts a schema resolver");
  if (strategy !== "schemaPerTenant" && options.centralSchema !== undefined)
    configuration("only schema-per-tenant accepts a central schema");
  if (strategy !== "schemaPerTenant" && options.role !== undefined)
    configuration("only schema-per-tenant accepts a role resolver");
  if (
    strategy === "databasePerTenant" &&
    typeof options.connection !== "function"
  )
    configuration("database-per-tenant requires a connection resolver");
  if (strategy !== "databasePerTenant" && options.connection !== undefined)
    configuration("only database-per-tenant accepts a connection resolver");
  if (strategy !== "databasePerTenant" && options.maxConnections !== undefined)
    configuration("only database-per-tenant accepts maxConnections");
  const maxConnections = options.maxConnections ?? DEFAULT_MAX_CONNECTIONS;
  if (
    strategy === "databasePerTenant" &&
    (!Number.isSafeInteger(maxConnections) || maxConnections <= 0)
  )
    configuration("database-per-tenant requires a positive maxConnections");
  const centralSchema = assertSqlIdentifier(options.centralSchema ?? "public", {
    label: "Drizzle central schema",
    createError: () =>
      new DrizzleTenancyConfigurationError(
        "Drizzle tenancy central schema must be a SQL identifier.",
      ),
  });
  if (!Array.isArray(options.tenantTables) || options.tenantTables.length === 0)
    configuration("requires at least one tenant table");
  if (
    options.centralTables !== undefined &&
    !Array.isArray(options.centralTables)
  )
    configuration("centralTables must be an array");

  const policies = new Map<DrizzleTable, DrizzleTablePolicy>();
  const tenantTables = options.tenantTables.map((entry) => {
    if (
      entry === null ||
      typeof entry !== "object" ||
      entry.table === undefined
    )
      configuration("tenant table entries require a table");
    const metadata = options.database.metadata(entry.table);
    const tenantProperty = identifier(
      entry.tenantProperty ?? "tenantId",
      "tenant property",
    );
    const tenantColumn = identifier(
      entry.tenantColumn ?? "tenant_id",
      "tenant column",
    );
    const policyName = identifier(
      entry.policyName ?? `${metadata.name}_tenant_isolation`,
      "policy name",
    );
    const column = metadata.columns[tenantProperty];
    if (
      strategy === "rowLevel" &&
      (column === undefined || column.name !== tenantColumn)
    )
      configuration(
        "tenant property and tenant column must match a Drizzle table column",
      );
    if (strategy === "schemaPerTenant" && metadata.schema !== undefined)
      configuration("schema-per-tenant tables must not declare a fixed schema");
    const normalized = Object.freeze({
      ...metadata,
      table: entry.table,
      qualifiedName:
        metadata.schema === undefined
          ? metadata.name
          : `${metadata.schema}.${metadata.name}`,
      tenantProperty,
      tenantColumn,
      policyName,
    });
    addPolicy(
      policies,
      entry.table,
      Object.freeze({ kind: "tenant", config: normalized }),
    );
    return normalized;
  });
  for (const entry of options.centralTables ?? []) {
    if (
      entry === null ||
      typeof entry !== "object" ||
      entry.table === undefined
    )
      configuration("central table entries require a table");
    options.database.metadata(entry.table);
    addPolicy(
      policies,
      entry.table,
      Object.freeze({ kind: "central", table: entry.table }),
    );
  }
  return Object.freeze({
    manager: options.manager,
    database: options.database,
    strategy,
    schema: options.schema,
    centralSchema,
    role: options.role,
    connection: options.connection,
    maxConnections,
    tenantTables: Object.freeze(tenantTables),
    classify: (table: DrizzleTable) => policies.get(table),
  });
}

function addPolicy(
  policies: Map<DrizzleTable, DrizzleTablePolicy>,
  table: DrizzleTable,
  policy: DrizzleTablePolicy,
): void {
  if (policies.has(table))
    configuration("tables must be classified exactly once");
  policies.set(table, policy);
}

function identifier(value: string, label: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value))
    configuration(`${label} must be a SQL identifier`);
  return value;
}

function configuration(message: string): never {
  throw new DrizzleTenancyConfigurationError(`Drizzle tenancy ${message}.`);
}
