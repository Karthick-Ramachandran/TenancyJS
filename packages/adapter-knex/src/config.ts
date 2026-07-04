import type { TenancyManager, TenantRecord } from "@tenancyjs/core";
import type { Knex } from "knex";

import {
  KnexTenancyConfigurationError,
  KnexUnregisteredTableError,
} from "./errors.js";

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const DEFAULT_TENANT_COLUMN = "tenant_id";

export const KNEX_TENANT_SETTING = "tenancyjs.tenant_id";
export const KNEX_CENTRAL_SETTING = "tenancyjs.is_central";

export interface KnexTenantTableConfig {
  readonly tenantColumn?: string;
  readonly policyName?: string;
}

export type KnexCentralTableConfig = Readonly<Record<string, never>>;

export interface KnexTenancyOptions<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly manager: TenancyManager<TTenant>;
  readonly knex: Knex;
  readonly tenantTables: Readonly<Record<string, KnexTenantTableConfig>>;
  readonly centralTables?: Readonly<Record<string, KnexCentralTableConfig>>;
}

export interface NormalizedKnexTenantTableConfig {
  readonly schema: string;
  readonly table: string;
  readonly qualifiedName: string;
  readonly tenantColumn: string;
  readonly policyName: string;
}

export interface NormalizedKnexCentralTableConfig {
  readonly schema: string;
  readonly table: string;
  readonly qualifiedName: string;
}

export interface KnexTenancyConfig<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly manager: TenancyManager<TTenant>;
  readonly knex: Knex;
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

  const tenantTables = normalizeTenantTables(options.tenantTables);
  const centralTables = normalizeCentralTables(options.centralTables ?? {});
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
    tenantTables,
    centralTables,
  });
}

export function classifyKnexTable<TTenant extends TenantRecord>(
  config: KnexTenancyConfig<TTenant>,
  name: string,
): KnexTablePolicy {
  const normalizedName = normalizeTableName(name).qualifiedName;
  const tenant = config.tenantTables[normalizedName];
  if (tenant !== undefined) return Object.freeze({ kind: "tenant", ...tenant });
  const central = config.centralTables[normalizedName];
  if (central !== undefined)
    return Object.freeze({ kind: "central", ...central });
  throw new KnexUnregisteredTableError(normalizedName);
}

function normalizeTenantTables(
  input: Readonly<Record<string, KnexTenantTableConfig>>,
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
    const table = normalizeTableName(name);
    const tenantColumn = value.tenantColumn ?? DEFAULT_TENANT_COLUMN;
    assertIdentifier(
      tenantColumn,
      `Tenant column for Knex table "${table.qualifiedName}"`,
    );
    const policyName = value.policyName ?? `${table.table}_tenant_isolation`;
    assertIdentifier(
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
    const table = normalizeTableName(name);
    if (Object.hasOwn(result, table.qualifiedName))
      duplicateTable(table.qualifiedName);
    result[table.qualifiedName] = Object.freeze(table);
  }
  return Object.freeze(result);
}

function normalizeTableName(name: string): NormalizedKnexCentralTableConfig {
  if (typeof name !== "string") invalidTable();
  const parts = name.split(".");
  if (parts.length > 2 || parts.some((part) => !IDENTIFIER.test(part)))
    invalidTable();
  const [schema, table] =
    parts.length === 1 ? ["public", parts[0]!] : [parts[0]!, parts[1]!];
  return Object.freeze({ schema, table, qualifiedName: `${schema}.${table}` });
}

function assertIdentifier(
  value: unknown,
  label: string,
): asserts value is string {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) {
    throw new KnexTenancyConfigurationError(
      `${label} must be a valid PostgreSQL identifier.`,
    );
  }
}

function invalidTable(): never {
  throw new KnexTenancyConfigurationError(
    "Knex table names must be an unaliased identifier or schema-qualified identifier.",
  );
}

function duplicateTable(name: string): never {
  throw new KnexTenancyConfigurationError(
    `Knex table "${name}" is configured more than once.`,
  );
}
