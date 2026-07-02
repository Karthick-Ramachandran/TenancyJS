import type { TenancyManager, TenantRecord } from "@tenancyjs/core";
import type { Database } from "@adonisjs/lucid/database";
import type { LucidModel } from "@adonisjs/lucid/types/model";

import { LucidTenancyConfigurationError } from "./errors.js";

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const DEFAULT_TENANT_ATTRIBUTE = "tenantId";
const DEFAULT_TENANT_COLUMN = "tenant_id";

export const LUCID_TENANT_SETTING = "tenancyjs.tenant_id";
export const LUCID_CENTRAL_SETTING = "tenancyjs.is_central";

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
}

export interface NormalizedLucidTenantModelConfig {
  readonly model: LucidModel;
  readonly modelName: string;
  readonly schema: string;
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

  const modelSet = new Set<LucidModel>();
  const tableSet = new Set<string>();
  const tenantModels = options.tenantModels.map((entry, index) => {
    const normalized = normalizeModel(entry, index);
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
    tenantModels: Object.freeze(tenantModels),
  });
}

function normalizeModel(
  entry: LucidTenantModelConfig,
  index: number,
): NormalizedLucidTenantModelConfig {
  if (entry === null || typeof entry !== "object") invalidModel(index);
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
  const table = normalizeTableName(tableName, modelName);
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
): Readonly<{ schema: string; table: string; qualifiedName: string }> {
  if (typeof name !== "string") invalidTable(modelName);
  const parts = name.split(".");
  if (parts.length > 2 || parts.some((part) => !IDENTIFIER.test(part))) {
    invalidTable(modelName);
  }
  const [schema, table] =
    parts.length === 1 ? ["public", parts[0]!] : [parts[0]!, parts[1]!];
  return Object.freeze({ schema, table, qualifiedName: `${schema}.${table}` });
}

function assertIdentifier(
  value: unknown,
  label: string,
): asserts value is string {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) {
    throw new LucidTenancyConfigurationError(
      `${label} must be a valid identifier.`,
    );
  }
}

function invalidModel(index: number): never {
  throw new LucidTenancyConfigurationError(
    `Lucid tenant model at index ${index} must be a Lucid model constructor.`,
  );
}

function invalidTable(modelName: string): never {
  throw new LucidTenancyConfigurationError(
    `Table for Lucid model "${modelName}" must be an unaliased PostgreSQL identifier or schema-qualified identifier.`,
  );
}
