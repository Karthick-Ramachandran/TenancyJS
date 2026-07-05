import type { TenancyManager, TenantRecord } from "tenancyjs-core";
import type { Connection, Model } from "mongoose";

import { MongooseTenancyConfigurationError } from "./errors.js";
import type {
  MongooseCentralModelConfig,
  MongooseDatabasePlacement,
  MongooseTenantModelConfig,
} from "./types.js";

const DEFAULT_MAX_CONNECTIONS = 25;

export interface MongooseTenancyOptions<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly manager: TenancyManager<TTenant>;
  readonly connection: Connection;
  readonly tenantModels: readonly MongooseTenantModelConfig[];
  readonly centralModels?: readonly MongooseCentralModelConfig[];
  readonly strategy?: "rowLevel" | "databasePerTenant";
  readonly database?: (tenant: TTenant) => MongooseDatabasePlacement;
  readonly maxConnections?: number;
}

export type MongooseModelPolicy =
  | Readonly<{ kind: "tenant"; model: Model<unknown>; tenantField: string }>
  | Readonly<{ kind: "central"; model: Model<unknown> }>;

export interface MongooseTenancyConfig<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly manager: TenancyManager<TTenant>;
  readonly connection: Connection;
  readonly strategy: "rowLevel" | "databasePerTenant";
  readonly database:
    ((tenant: TTenant) => MongooseDatabasePlacement) | undefined;
  readonly maxConnections: number;
  classify(model: Model<unknown>): MongooseModelPolicy | undefined;
}

export function defineMongooseTenancyConfig<
  TTenant extends TenantRecord = TenantRecord,
>(options: MongooseTenancyOptions<TTenant>): MongooseTenancyConfig<TTenant> {
  if (options === null || typeof options !== "object")
    configuration("options are required");
  if (typeof options.manager?.getContext !== "function")
    configuration("requires a TenancyManager");
  if (typeof options.connection?.transaction !== "function")
    configuration("requires a Connection");
  const strategy = options.strategy ?? "rowLevel";
  if (strategy !== "rowLevel" && strategy !== "databasePerTenant")
    configuration("strategy must be rowLevel or databasePerTenant");
  if (
    strategy === "databasePerTenant" &&
    typeof options.database !== "function"
  )
    configuration("database-per-tenant requires a database resolver");
  if (strategy !== "databasePerTenant" && options.database !== undefined)
    configuration("only database-per-tenant accepts a database resolver");
  if (strategy !== "databasePerTenant" && options.maxConnections !== undefined)
    configuration("only database-per-tenant accepts maxConnections");
  const maxConnections = options.maxConnections ?? DEFAULT_MAX_CONNECTIONS;
  if (
    strategy === "databasePerTenant" &&
    (!Number.isSafeInteger(maxConnections) || maxConnections <= 0)
  )
    configuration("database-per-tenant requires a positive maxConnections");
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
  const policies = new Map<Model<unknown>, MongooseModelPolicy>();
  for (const entry of options.tenantModels) {
    if (
      entry === null ||
      typeof entry !== "object" ||
      typeof entry.model !== "function"
    ) {
      configuration("tenant model entries require a model");
    }
    const tenantField = entry.tenantField ?? "tenantId";
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tenantField)) {
      configuration("tenant fields must be identifiers");
    }
    addPolicy(
      policies,
      entry.model,
      Object.freeze({ kind: "tenant", model: entry.model, tenantField }),
    );
  }
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
    connection: options.connection,
    strategy,
    database: options.database,
    maxConnections,
    classify: (model: Model<unknown>) => policies.get(model),
  });
}

function addPolicy(
  policies: Map<Model<unknown>, MongooseModelPolicy>,
  model: Model<unknown>,
  policy: MongooseModelPolicy,
): void {
  if (policies.has(model))
    configuration("models must be classified exactly once");
  policies.set(model, policy);
}

function configuration(message: string): never {
  throw new MongooseTenancyConfigurationError(`Mongoose tenancy ${message}.`);
}
