import type {
  MaybePromise,
  TenancyAdapter,
  TenancyAdapterValidationResult,
  TenantContext,
  TenantRecord,
} from "@tenancyjs/core";
import { TenantContextError } from "@tenancyjs/core";
import {
  PostgresStrategyValidationError,
  applyPostgresRowContext,
  createPostgresStrategyEngine,
  createTenantResourceCache,
  type PostgresExecutor,
  type PostgresSchemaStrategyEngine,
} from "@tenancyjs/adapter-shared";
import type { Knex } from "knex";

import { KNEX_ADAPTER_CAPABILITIES } from "./capabilities.js";
import {
  type KnexTenancyConfig,
  type KnexTenancyOptions,
  classifyKnexTable,
  defineKnexTenancyConfig,
} from "./config.js";
import {
  KnexPolicyValidationError,
  KnexTenancyConfigurationError,
} from "./errors.js";
import { createProtectedKnexClient } from "./query.js";
import type { ProtectedKnexClient } from "./types.js";
import { validateKnexPolicies } from "./validation.js";

export interface KnexTenancyAdapter<
  TTenant extends TenantRecord = TenantRecord,
> extends TenancyAdapter {
  readonly name: "knex";
  readonly strategy: "rowLevel" | "schemaPerTenant" | "databasePerTenant";
  readonly config: KnexTenancyConfig<TTenant>;
  run<TResult>(
    callback: (client: ProtectedKnexClient) => MaybePromise<TResult>,
  ): Promise<TResult>;
  close(): Promise<void>;
}

export function createKnexTenancy<TTenant extends TenantRecord = TenantRecord>(
  options: KnexTenancyOptions<TTenant>,
): KnexTenancyAdapter<TTenant> {
  const config = defineKnexTenancyConfig(options);
  const schemaEngine = createSchemaEngine(config);
  const connectionCache =
    config.strategy === "databasePerTenant"
      ? createTenantResourceCache<Knex>({
          capacity: config.maxConnections,
          destroy: (client) => client.destroy(),
        })
      : undefined;
  let validated = false;

  async function validate(): Promise<TenancyAdapterValidationResult> {
    // Database-per-tenant isolation is structural (separate databases); there
    // is no RLS/schema contract to introspect, so the strategy is valid once
    // configured. Per-tenant connectivity fails closed at first lease.
    if (config.strategy === "databasePerTenant") {
      validated = true;
      return Object.freeze({ valid: true, issues: Object.freeze([]) });
    }
    try {
      const result =
        config.strategy === "rowLevel"
          ? await validateKnexPolicies(config)
          : await schemaEngine!.validate(knexExecutor(config.knex));
      validated = result.valid;
      return result;
    } catch {
      validated = false;
      return validationFailure(config.strategy);
    }
  }

  async function runScope<TResult>(
    client: Knex,
    context: TenantContext<TTenant>,
    callback: (client: ProtectedKnexClient) => MaybePromise<TResult>,
  ): Promise<TResult> {
    const applyContext = config.strategy !== "databasePerTenant";
    return client.transaction(async (transaction) => {
      if (applyContext) {
        await setTransactionContext(transaction, context, schemaEngine);
      }
      const createSavepoint = async <TSavepoint>(
        parent: Knex.Transaction,
        savepointCallback: (savepoint: Knex.Transaction) => Promise<TSavepoint>,
      ): Promise<TSavepoint> =>
        parent.transaction(async (savepoint) => {
          if (applyContext) {
            await setTransactionContext(savepoint, context, schemaEngine);
          }
          return savepointCallback(savepoint);
        });
      const protectedClient = createProtectedKnexClient(
        transaction,
        context,
        (name) => classifyKnexTable(config, name),
        createSavepoint,
        config.strategy,
      );
      return callback(protectedClient);
    });
  }

  async function run<TResult>(
    callback: (client: ProtectedKnexClient) => MaybePromise<TResult>,
  ): Promise<TResult> {
    if (!validated) throw new KnexPolicyValidationError();
    if (typeof callback !== "function") {
      throw new KnexTenancyConfigurationError(
        "Protected Knex execution requires a callback.",
      );
    }
    const context = config.manager.getContext();
    if (context === undefined) throw new TenantContextError("missing");

    if (config.strategy === "databasePerTenant" && context.mode === "tenant") {
      const placement = config.connection!(context.tenant);
      return connectionCache!.lease(
        context.tenant.id,
        placement.key,
        placement.create,
        (leased) => runScope(leased, context, callback),
      );
    }
    return runScope(config.knex, context, callback);
  }

  async function close(): Promise<void> {
    if (connectionCache !== undefined) await connectionCache.close();
  }

  return Object.freeze({
    name: "knex",
    strategy: config.strategy,
    capabilities: KNEX_ADAPTER_CAPABILITIES,
    config,
    validate,
    run,
    close,
  });
}

function validationFailure(
  strategy: "rowLevel" | "schemaPerTenant" | "databasePerTenant",
): TenancyAdapterValidationResult {
  return Object.freeze({
    valid: false,
    issues: Object.freeze([
      Object.freeze({
        code: "TENANCY_KNEX_POLICY_INTROSPECTION_FAILED",
        severity: "error" as const,
        message:
          strategy === "rowLevel"
            ? "Knex tenancy could not verify the PostgreSQL RLS contract."
            : "Knex tenancy could not verify the PostgreSQL schema isolation contract.",
      }),
    ]),
  });
}

async function setTransactionContext(
  transaction: Knex.Transaction,
  context: NonNullable<ReturnType<KnexTenancyConfig["manager"]["getContext"]>>,
  schemaEngine: PostgresSchemaStrategyEngine | undefined,
): Promise<void> {
  const execute = knexExecutor(transaction);
  try {
    if (schemaEngine === undefined) {
      await applyPostgresRowContext(execute, context);
    } else {
      await schemaEngine.applyContext(execute, context);
    }
  } catch (error) {
    if (error instanceof PostgresStrategyValidationError) {
      throw new KnexPolicyValidationError();
    }
    throw error;
  }
}

function knexExecutor(client: Pick<Knex, "raw">): PostgresExecutor {
  return (sql, bindings) =>
    bindings === undefined ? client.raw(sql) : client.raw(sql, [...bindings]);
}

function createSchemaEngine<TTenant extends TenantRecord>(
  config: KnexTenancyConfig<TTenant>,
): PostgresSchemaStrategyEngine<TTenant> | undefined {
  if (config.strategy !== "schemaPerTenant") return undefined;
  return createPostgresStrategyEngine({
    codePrefix: "TENANCY_KNEX",
    adapterName: "Knex",
    resolveSchema: config.schema!,
    centralSchema: config.centralSchema,
    tenantTables: Object.values(config.tenantTables).map(
      (table) => table.table,
    ),
    centralTables: Object.values(config.centralTables).map(
      (table) => table.table,
    ),
  });
}
