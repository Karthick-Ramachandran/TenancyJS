import type { TenancyManager, TenantRecord } from "@tenancyjs/core";
import {
  POSTGRES_CENTRAL_SETTING,
  POSTGRES_TENANT_SETTING,
  assertSqlIdentifier,
  normalizeQualifiedTable,
} from "@tenancyjs/adapter-shared";
import type { Database } from "@adonisjs/lucid/database";
import type { LucidModel } from "@adonisjs/lucid/types/model";

import { LucidTenancyConfigurationError } from "./errors.js";

const DEFAULT_TENANT_ATTRIBUTE = "tenantId";
const DEFAULT_TENANT_COLUMN = "tenant_id";

export const LUCID_TENANT_SETTING = POSTGRES_TENANT_SETTING;
export const LUCID_CENTRAL_SETTING = POSTGRES_CENTRAL_SETTING;

export interface LucidTenantModelConfig {
  readonly model: LucidModel;
  readonly table?: string;
  readonly tenantAttribute?: string;
  readonly tenantColumn?: string;
  readonly policyName?: string;
}

export interface LucidTenancyOptions<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly manager: TenancyManager<TTenant>;
  readonly database: Database;
  readonly tenantModels: readonly LucidTenantModelConfig[];
  readonly strategy?: "rowLevel" | "schemaPerTenant";
  readonly schema?: (tenant: TTenant) => string;
  readonly centralSchema?: string;
}

export interface NormalizedLucidTenantModelConfig {
  readonly model: LucidModel;
  readonly modelName: string;
  readonly schema: string | undefined;
  readonly table: string;
  readonly qualifiedName: string;
  readonly tenantAttribute: string;
  readonly tenantColumn: string;
  readonly policyName: string;
}

export interface LucidTenancyConfig<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly manager: TenancyManager<TTenant>;
  readonly database: Database;
  readonly strategy: "rowLevel" | "schemaPerTenant";
  readonly schema: ((tenant: TTenant) => string) | undefined;
  readonly centralSchema: string;
  readonly tenantModels: readonly Readonly<NormalizedLucidTenantModelConfig>[];
}

export function defineLucidTenancyConfig<
  TTenant extends TenantRecord = TenantRecord,
>(options: LucidTenancyOptions<TTenant>): LucidTenancyConfig<TTenant> {
  if (options === null || typeof options !== "object") {
    throw new LucidTenancyConfigurationError(
      "Lucid tenancy options must be an object.",
    );
  }
  if (
    options.manager === null ||
    typeof options.manager !== "object" ||
    typeof options.manager.getContext !== "function"
  ) {
    throw new LucidTenancyConfigurationError(
      "Lucid tenancy options require a TenancyManager.",
    );
  }
  if (
    options.database === null ||
    typeof options.database !== "object" ||
    typeof options.database.transaction !== "function" ||
    typeof options.database.rawQuery !== "function"
  ) {
    throw new LucidTenancyConfigurationError(
      "Lucid tenancy options require a Lucid Database service.",
    );
  }
  if (
    !Array.isArray(options.tenantModels) ||
    options.tenantModels.length === 0
  ) {
    throw new LucidTenancyConfigurationError(
      "At least one tenant-scoped Lucid model is required.",
    );
  }

  const strategy = options.strategy ?? "rowLevel";
  if (strategy !== "rowLevel" && strategy !== "schemaPerTenant") {
    throw new LucidTenancyConfigurationError(
      "Lucid tenancy strategy must be rowLevel or schemaPerTenant.",
    );
  }
  if (strategy === "schemaPerTenant" && typeof options.schema !== "function") {
    throw new LucidTenancyConfigurationError(
      "Lucid schema-per-tenant requires a schema resolver.",
    );
  }
  if (strategy === "rowLevel" && options.schema !== undefined) {
    throw new LucidTenancyConfigurationError(
      "Lucid row-level tenancy does not accept a schema resolver.",
    );
  }
  if (strategy === "rowLevel" && options.centralSchema !== undefined) {
    throw new LucidTenancyConfigurationError(
      "Lucid row-level tenancy does not accept a central schema placement.",
    );
  }
  const centralSchema = assertIdentifier(
    options.centralSchema ?? "public",
    "Central schema",
  );

  const modelSet = new Set<LucidModel>();
  const tableSet = new Set<string>();
  const tenantModels = options.tenantModels.map((entry, index) => {
    const normalized = normalizeModel(entry, index, strategy);
    if (modelSet.has(normalized.model)) {
      throw new LucidTenancyConfigurationError(
        `Lucid model "${normalized.modelName}" is configured more than once.`,
      );
    }
    if (tableSet.has(normalized.qualifiedName)) {
      throw new LucidTenancyConfigurationError(
        `Lucid table "${normalized.qualifiedName}" is configured more than once.`,
      );
    }
    modelSet.add(normalized.model);
    tableSet.add(normalized.qualifiedName);
    return Object.freeze(normalized);
  });

  return Object.freeze({
    manager: options.manager,
    database: options.database,
    strategy,
    schema: options.schema,
    centralSchema,
    tenantModels: Object.freeze(tenantModels),
  });
}

function normalizeModel(
  entry: LucidTenantModelConfig,
  index: number,
  strategy: "rowLevel" | "schemaPerTenant",
): NormalizedLucidTenantModelConfig {
  if (entry === null || typeof entry !== "object") invalidModel(index);
  if (
    strategy === "schemaPerTenant" &&
    (entry.tenantAttribute !== undefined ||
      entry.tenantColumn !== undefined ||
      entry.policyName !== undefined)
  ) {
    throw new LucidTenancyConfigurationError(
      `Lucid schema-per-tenant model at index ${index} cannot configure row-level tenant attributes, columns, or RLS policies.`,
    );
  }
  const model = entry.model;
  if (
    typeof model !== "function" ||
    typeof model.boot !== "function" ||
    typeof model.before !== "function"
  ) {
    invalidModel(index);
  }
  const modelName = model.name || `model-${index}`;
  const tableName = entry.table ?? model.table;
  const table = normalizeTableName(tableName, modelName, strategy);
  if (
    strategy === "schemaPerTenant" &&
    (typeof model.table !== "string" || model.table !== table.table)
  ) {
    throw new LucidTenancyConfigurationError(
      `Lucid model "${modelName}" must use the same unqualified table name configured for schema-per-tenant.`,
    );
  }
  const tenantAttribute = entry.tenantAttribute ?? DEFAULT_TENANT_ATTRIBUTE;
  const tenantColumn = entry.tenantColumn ?? DEFAULT_TENANT_COLUMN;
  const policyName = entry.policyName ?? `${table.table}_tenant_isolation`;
  assertIdentifier(
    tenantAttribute,
    `Tenant attribute for Lucid model "${modelName}"`,
  );
  assertIdentifier(
    tenantColumn,
    `Tenant column for Lucid model "${modelName}"`,
  );
  assertIdentifier(policyName, `RLS policy for Lucid model "${modelName}"`);
  return {
    model,
    modelName,
    ...table,
    tenantAttribute,
    tenantColumn,
    policyName,
  };
}

function normalizeTableName(
  name: unknown,
  modelName: string,
  strategy: "rowLevel" | "schemaPerTenant",
): Readonly<{
  schema: string | undefined;
  table: string;
  qualifiedName: string;
}> {
  const normalized = normalizeQualifiedTable(name, {
    label: `Table for Lucid model "${modelName}"`,
    allowQualified: strategy === "rowLevel",
    ...(strategy === "rowLevel" ? { defaultSchema: "public" } : {}),
    createError: () =>
      new LucidTenancyConfigurationError(
        strategy === "rowLevel"
          ? `Table for Lucid model "${modelName}" must be an unaliased PostgreSQL identifier or schema-qualified identifier.`
          : `Table for Lucid model "${modelName}" must be an unqualified PostgreSQL identifier in schema-per-tenant mode.`,
      ),
  });
  return Object.freeze({
    schema: normalized.schema,
    table: normalized.table,
    qualifiedName: normalized.qualifiedName,
  });
}

function assertIdentifier(value: unknown, label: string): string {
  return assertSqlIdentifier(value, {
    label,
    createError: () =>
      new LucidTenancyConfigurationError(
        `${label} must be a valid identifier.`,
      ),
  });
}

function invalidModel(index: number): never {
  throw new LucidTenancyConfigurationError(
    `Lucid tenant model at index ${index} must be a Lucid model constructor.`,
  );
}
