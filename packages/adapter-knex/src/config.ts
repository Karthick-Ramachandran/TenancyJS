import type {
  MaybePromise,
  TenancyManager,
  TenantRecord,
} from "@tenancyjs/core";
import {
  POSTGRES_CENTRAL_SETTING,
  POSTGRES_TENANT_SETTING,
  assertSqlIdentifier,
  normalizeQualifiedTable,
} from "@tenancyjs/adapter-shared";
import type { Knex } from "knex";

import {
  KnexTenancyConfigurationError,
  KnexUnregisteredTableError,
} from "./errors.js";

const DEFAULT_TENANT_COLUMN = "tenant_id";
const DEFAULT_MAX_CONNECTIONS = 25;

export const KNEX_TENANT_SETTING = POSTGRES_TENANT_SETTING;
export const KNEX_CENTRAL_SETTING = POSTGRES_CENTRAL_SETTING;

export interface KnexTenantTableConfig {
  readonly tenantColumn?: string;
  readonly policyName?: string;
}

export type KnexCentralTableConfig = Readonly<Record<string, never>>;

export interface KnexDatabasePlacement {
  readonly key: string;
  readonly create: () => MaybePromise<Knex>;
}

export interface KnexTenancyOptions<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly manager: TenancyManager<TTenant>;
  readonly knex: Knex;
  readonly tenantTables: Readonly<Record<string, KnexTenantTableConfig>>;
  readonly centralTables?: Readonly<Record<string, KnexCentralTableConfig>>;
  readonly strategy?: "rowLevel" | "schemaPerTenant" | "databasePerTenant";
  readonly schema?: (tenant: TTenant) => string;
  readonly centralSchema?: string;
  /** Opt-in database-enforced schema-per-tenant: a per-tenant Postgres role. */
  readonly role?: (tenant: TTenant) => string;
  readonly connection?: (tenant: TTenant) => KnexDatabasePlacement;
  readonly maxConnections?: number;
}

export interface NormalizedKnexTenantTableConfig {
  readonly schema: string | undefined;
  readonly table: string;
  readonly qualifiedName: string;
  readonly tenantColumn: string;
  readonly policyName: string;
}

export interface NormalizedKnexCentralTableConfig {
  readonly schema: string | undefined;
  readonly table: string;
  readonly qualifiedName: string;
}

export interface KnexTenancyConfig<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly manager: TenancyManager<TTenant>;
  readonly knex: Knex;
  readonly strategy: "rowLevel" | "schemaPerTenant" | "databasePerTenant";
  readonly schema: ((tenant: TTenant) => string) | undefined;
  readonly centralSchema: string;
  readonly role: ((tenant: TTenant) => string) | undefined;
  readonly connection: ((tenant: TTenant) => KnexDatabasePlacement) | undefined;
  readonly maxConnections: number;
  readonly tenantTables: Readonly<
    Record<string, Readonly<NormalizedKnexTenantTableConfig>>
  >;
  readonly centralTables: Readonly<
    Record<string, Readonly<NormalizedKnexCentralTableConfig>>
  >;
}

export type KnexTablePolicy =
  | Readonly<{ kind: "tenant" } & NormalizedKnexTenantTableConfig>
  | Readonly<{ kind: "central" } & NormalizedKnexCentralTableConfig>;

export function defineKnexTenancyConfig<
  TTenant extends TenantRecord = TenantRecord,
>(options: KnexTenancyOptions<TTenant>): KnexTenancyConfig<TTenant> {
  if (options === null || typeof options !== "object") {
    throw new KnexTenancyConfigurationError(
      "Knex tenancy options must be an object.",
    );
  }
  if (
    options.manager === null ||
    typeof options.manager !== "object" ||
    typeof options.manager.getContext !== "function"
  ) {
    throw new KnexTenancyConfigurationError(
      "Knex tenancy options require a TenancyManager.",
    );
  }
  if (
    typeof options.knex !== "function" ||
    typeof options.knex.transaction !== "function"
  ) {
    throw new KnexTenancyConfigurationError(
      "Knex tenancy options require a Knex client.",
    );
  }

  const strategy = options.strategy ?? "rowLevel";
  if (
    strategy !== "rowLevel" &&
    strategy !== "schemaPerTenant" &&
    strategy !== "databasePerTenant"
  ) {
    throw new KnexTenancyConfigurationError(
      "Knex tenancy strategy must be rowLevel, schemaPerTenant, or databasePerTenant.",
    );
  }
  if (strategy === "schemaPerTenant" && typeof options.schema !== "function") {
    throw new KnexTenancyConfigurationError(
      "Knex schema-per-tenant requires a schema resolver.",
    );
  }
  if (strategy !== "schemaPerTenant" && options.schema !== undefined) {
    throw new KnexTenancyConfigurationError(
      "Only Knex schema-per-tenant accepts a schema resolver.",
    );
  }
  if (strategy !== "schemaPerTenant" && options.centralSchema !== undefined) {
    throw new KnexTenancyConfigurationError(
      "Only Knex schema-per-tenant accepts a central schema placement.",
    );
  }
  if (strategy !== "schemaPerTenant" && options.role !== undefined) {
    throw new KnexTenancyConfigurationError(
      "Only Knex schema-per-tenant accepts a role resolver.",
    );
  }
  if (
    strategy === "databasePerTenant" &&
    typeof options.connection !== "function"
  ) {
    throw new KnexTenancyConfigurationError(
      "Knex database-per-tenant requires a connection resolver.",
    );
  }
  if (strategy !== "databasePerTenant" && options.connection !== undefined) {
    throw new KnexTenancyConfigurationError(
      "Only Knex database-per-tenant accepts a connection resolver.",
    );
  }
  if (
    strategy !== "databasePerTenant" &&
    options.maxConnections !== undefined
  ) {
    throw new KnexTenancyConfigurationError(
      "Only Knex database-per-tenant accepts maxConnections.",
    );
  }
  const maxConnections = options.maxConnections ?? DEFAULT_MAX_CONNECTIONS;
  if (
    strategy === "databasePerTenant" &&
    (!Number.isSafeInteger(maxConnections) || maxConnections <= 0)
  ) {
    throw new KnexTenancyConfigurationError(
      "Knex database-per-tenant requires a positive maxConnections.",
    );
  }
  const centralSchema = assertKnexIdentifier(
    options.centralSchema ?? "public",
    "Central schema",
  );
  const tenantTables = normalizeTenantTables(options.tenantTables, strategy);
  const centralTables = normalizeCentralTables(
    options.centralTables ?? {},
    strategy,
  );
  for (const name of Object.keys(centralTables)) {
    if (Object.hasOwn(tenantTables, name)) {
      throw new KnexTenancyConfigurationError(
        `Knex table "${name}" cannot be both tenant-scoped and central.`,
      );
    }
  }
  return Object.freeze({
    manager: options.manager,
    knex: options.knex,
    strategy,
    schema: options.schema,
    centralSchema,
    role: options.role,
    connection: options.connection,
    maxConnections,
    tenantTables,
    centralTables,
  });
}

export function classifyKnexTable<TTenant extends TenantRecord>(
  config: KnexTenancyConfig<TTenant>,
  name: string,
): KnexTablePolicy {
  const normalizedName = normalizeTableName(
    name,
    config.strategy,
  ).qualifiedName;
  const tenant = config.tenantTables[normalizedName];
  if (tenant !== undefined) return Object.freeze({ kind: "tenant", ...tenant });
  const central = config.centralTables[normalizedName];
  if (central !== undefined)
    return Object.freeze({ kind: "central", ...central });
  throw new KnexUnregisteredTableError(normalizedName);
}

function normalizeTenantTables(
  input: Readonly<Record<string, KnexTenantTableConfig>>,
  strategy: "rowLevel" | "schemaPerTenant" | "databasePerTenant",
): Readonly<Record<string, Readonly<NormalizedKnexTenantTableConfig>>> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new KnexTenancyConfigurationError(
      "tenantTables must be a table configuration object.",
    );
  }
  if (Object.keys(input).length === 0) {
    throw new KnexTenancyConfigurationError(
      "At least one tenant-scoped Knex table is required.",
    );
  }
  const result: Record<string, Readonly<NormalizedKnexTenantTableConfig>> = {};
  for (const [name, value] of Object.entries(input)) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new KnexTenancyConfigurationError(
        `Configuration for Knex table "${name}" must be an object.`,
      );
    }
    if (
      strategy !== "rowLevel" &&
      (value.tenantColumn !== undefined || value.policyName !== undefined)
    ) {
      throw new KnexTenancyConfigurationError(
        `Knex ${strategy} table "${name}" cannot configure row-level tenant columns or RLS policies.`,
      );
    }
    const table = normalizeTableName(name, strategy);
    const tenantColumn = value.tenantColumn ?? DEFAULT_TENANT_COLUMN;
    assertKnexIdentifier(
      tenantColumn,
      `Tenant column for Knex table "${table.qualifiedName}"`,
    );
    const policyName = value.policyName ?? `${table.table}_tenant_isolation`;
    assertKnexIdentifier(
      policyName,
      `RLS policy for Knex table "${table.qualifiedName}"`,
    );
    if (Object.hasOwn(result, table.qualifiedName))
      duplicateTable(table.qualifiedName);
    result[table.qualifiedName] = Object.freeze({
      ...table,
      tenantColumn,
      policyName,
    });
  }
  return Object.freeze(result);
}

function normalizeCentralTables(
  input: Readonly<Record<string, KnexCentralTableConfig>>,
  strategy: "rowLevel" | "schemaPerTenant" | "databasePerTenant",
): Readonly<Record<string, Readonly<NormalizedKnexCentralTableConfig>>> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new KnexTenancyConfigurationError(
      "centralTables must be a table configuration object.",
    );
  }
  const result: Record<string, Readonly<NormalizedKnexCentralTableConfig>> = {};
  for (const [name, value] of Object.entries(input)) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new KnexTenancyConfigurationError(
        `Configuration for central Knex table "${name}" must be an object.`,
      );
    }
    const table = normalizeTableName(name, strategy);
    if (Object.hasOwn(result, table.qualifiedName))
      duplicateTable(table.qualifiedName);
    result[table.qualifiedName] = Object.freeze(table);
  }
  return Object.freeze(result);
}

function normalizeTableName(
  name: string,
  strategy: "rowLevel" | "schemaPerTenant" | "databasePerTenant",
): NormalizedKnexCentralTableConfig {
  const normalized = normalizeQualifiedTable(name, {
    label: "Knex table name",
    allowQualified: strategy !== "schemaPerTenant",
    ...(strategy !== "schemaPerTenant" ? { defaultSchema: "public" } : {}),
    createError: () =>
      new KnexTenancyConfigurationError(
        strategy === "schemaPerTenant"
          ? "Knex schema-per-tenant table names must be unqualified identifiers."
          : "Knex table names must be an unaliased identifier or schema-qualified identifier.",
      ),
  });
  return Object.freeze({
    schema: normalized.schema,
    table: normalized.table,
    qualifiedName: normalized.qualifiedName,
  });
}

function assertKnexIdentifier(value: unknown, label: string): string {
  return assertSqlIdentifier(value, {
    label,
    createError: (message) => new KnexTenancyConfigurationError(message),
  });
}

function duplicateTable(name: string): never {
  throw new KnexTenancyConfigurationError(
    `Knex table "${name}" is configured more than once.`,
  );
}
