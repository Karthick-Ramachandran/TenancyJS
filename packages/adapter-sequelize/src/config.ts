import type { TenancyManager, TenantRecord } from "tenancyjs-core";
import {
  assertSqlIdentifier,
  normalizeQualifiedTable,
} from "tenancyjs-adapter-shared";
import type { Model, ModelStatic, Sequelize } from "sequelize";

import { SequelizeTenancyConfigurationError } from "./errors.js";
import type {
  SequelizeCentralModelConfig,
  SequelizeDatabasePlacement,
  SequelizeTenantModelConfig,
} from "./types.js";

const DEFAULT_MAX_CONNECTIONS = 25;

export interface SequelizeTenancyOptions<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly manager: TenancyManager<TTenant>;
  readonly sequelize: Sequelize;
  readonly tenantModels: readonly SequelizeTenantModelConfig[];
  readonly centralModels?: readonly SequelizeCentralModelConfig[];
  readonly strategy?: "rowLevel" | "schemaPerTenant" | "databasePerTenant";
  readonly schema?: (tenant: TTenant) => string;
  readonly centralSchema?: string;
  readonly role?: (tenant: TTenant) => string;
  readonly connection?: (tenant: TTenant) => SequelizeDatabasePlacement;
  readonly maxConnections?: number;
}

export interface NormalizedSequelizeTenantModelConfig {
  readonly model: ModelStatic<Model>;
  readonly schema: string | undefined;
  readonly table: string;
  readonly qualifiedName: string;
  readonly tenantAttribute: string;
  readonly tenantColumn: string;
  readonly policyName: string;
}

export type SequelizeModelPolicy =
  | Readonly<{ kind: "tenant"; config: NormalizedSequelizeTenantModelConfig }>
  | Readonly<{ kind: "central"; model: ModelStatic<Model> }>;

export interface SequelizeTenancyConfig<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly manager: TenancyManager<TTenant>;
  readonly sequelize: Sequelize;
  readonly strategy: "rowLevel" | "schemaPerTenant" | "databasePerTenant";
  readonly schema: ((tenant: TTenant) => string) | undefined;
  readonly centralSchema: string;
  readonly role: ((tenant: TTenant) => string) | undefined;
  readonly connection:
    ((tenant: TTenant) => SequelizeDatabasePlacement) | undefined;
  readonly maxConnections: number;
  readonly tenantModels: readonly Readonly<NormalizedSequelizeTenantModelConfig>[];
  classify(model: ModelStatic<Model>): SequelizeModelPolicy | undefined;
}

export function defineSequelizeTenancyConfig<
  TTenant extends TenantRecord = TenantRecord,
>(options: SequelizeTenancyOptions<TTenant>): SequelizeTenancyConfig<TTenant> {
  if (options === null || typeof options !== "object")
    configuration("options are required");
  if (typeof options.manager?.getContext !== "function")
    configuration("requires a TenancyManager");
  if (typeof options.sequelize?.transaction !== "function")
    configuration("requires a Sequelize instance");
  const strategy = options.strategy ?? "rowLevel";
  if (
    strategy !== "rowLevel" &&
    strategy !== "schemaPerTenant" &&
    strategy !== "databasePerTenant"
  )
    configuration(
      "strategy must be rowLevel, schemaPerTenant, or databasePerTenant",
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
    label: "Sequelize central schema",
    createError: () =>
      new SequelizeTenancyConfigurationError(
        "Sequelize tenancy central schema must be a SQL identifier.",
      ),
  });
  if (
    !Array.isArray(options.tenantModels) ||
    options.tenantModels.length === 0
  ) {
    configuration("requires at least one tenant model");
  }
  if (
    options.centralModels !== undefined &&
    !Array.isArray(options.centralModels)
  ) {
    configuration("centralModels must be an array");
  }
  const policies = new Map<ModelStatic<Model>, SequelizeModelPolicy>();
  const tenantModels = options.tenantModels.map((entry) => {
    if (
      entry === null ||
      typeof entry !== "object" ||
      typeof entry.model !== "function"
    ) {
      configuration("tenant model entries require a model and table");
    }
    let table;
    try {
      table = normalizeQualifiedTable(entry.table, {
        ...(strategy === "rowLevel" ? { defaultSchema: "public" } : {}),
        allowQualified: strategy === "rowLevel",
        label: "Sequelize tenant table",
      });
    } catch {
      configuration("tenant tables must be valid SQL identifiers");
    }
    const normalized = Object.freeze({
      model: entry.model,
      schema: table.schema,
      table: table.table,
      qualifiedName: table.qualifiedName,
      tenantAttribute: identifier(
        entry.tenantAttribute ?? "tenantId",
        "tenant attribute",
      ),
      tenantColumn: identifier(
        entry.tenantColumn ?? "tenant_id",
        "tenant column",
      ),
      policyName: identifier(
        entry.policyName ?? `${table.table}_tenant_isolation`,
        "policy name",
      ),
    });
    if (strategy === "schemaPerTenant") {
      const modelTable = entry.model.getTableName();
      if (typeof modelTable !== "string") {
        configuration(
          "schema-per-tenant models must not declare a fixed schema",
        );
      }
    }
    addPolicy(
      policies,
      entry.model,
      Object.freeze({ kind: "tenant", config: normalized }),
    );
    return normalized;
  });
  for (const entry of options.centralModels ?? []) {
    if (
      entry === null ||
      typeof entry !== "object" ||
      typeof entry.model !== "function"
    ) {
      configuration("central model entries require a model");
    }
    addPolicy(
      policies,
      entry.model,
      Object.freeze({ kind: "central", model: entry.model }),
    );
  }
  return Object.freeze({
    manager: options.manager,
    sequelize: options.sequelize,
    strategy,
    schema: options.schema,
    centralSchema,
    role: options.role,
    connection: options.connection,
    maxConnections,
    tenantModels: Object.freeze(tenantModels),
    classify: (model: ModelStatic<Model>) => policies.get(model),
  });
}

function addPolicy(
  policies: Map<ModelStatic<Model>, SequelizeModelPolicy>,
  model: ModelStatic<Model>,
  policy: SequelizeModelPolicy,
): void {
  if (policies.has(model))
    configuration("models must be classified exactly once");
  policies.set(model, policy);
}

function identifier(value: string, label: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value))
    configuration(`${label} must be a SQL identifier`);
  return value;
}

function configuration(message: string): never {
  throw new SequelizeTenancyConfigurationError(`Sequelize tenancy ${message}.`);
}
