import type {
  MaybePromise,
  TenancyAdapter,
  TenancyAdapterValidationResult,
  TenantRecord,
} from "@tenancyjs/core";
import { TenantContextError } from "@tenancyjs/core";
import {
  PostgresStrategyValidationError,
  applyPostgresRowContext,
  createPostgresStrategyEngine,
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
  readonly strategy: "rowLevel" | "schemaPerTenant";
  readonly config: KnexTenancyConfig<TTenant>;
  run<TResult>(
    callback: (client: ProtectedKnexClient) => MaybePromise<TResult>,
  ): Promise<TResult>;
}

export function createKnexTenancy<TTenant extends TenantRecord = TenantRecord>(
  options: KnexTenancyOptions<TTenant>,
): KnexTenancyAdapter<TTenant> {
  const config = defineKnexTenancyConfig(options);
  const schemaEngine = createSchemaEngine(config);
  let validated = false;

  async function validate(): Promise<TenancyAdapterValidationResult> {
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

    return config.knex.transaction(async (transaction) => {
      await setTransactionContext(transaction, context, schemaEngine);
      const createSavepoint = async <TSavepoint>(
        parent: Knex.Transaction,
        savepointCallback: (savepoint: Knex.Transaction) => Promise<TSavepoint>,
      ): Promise<TSavepoint> =>
        parent.transaction(async (savepoint) => {
          await setTransactionContext(savepoint, context, schemaEngine);
          return savepointCallback(savepoint);
        });
      const client = createProtectedKnexClient(
        transaction,
        context,
        (name) => classifyKnexTable(config, name),
        createSavepoint,
        config.strategy,
      );
      return callback(client);
    });
  }

  return Object.freeze({
    name: "knex",
    strategy: config.strategy,
    capabilities: KNEX_ADAPTER_CAPABILITIES,
    config,
    validate,
    run,
  });
}

function validationFailure(
  strategy: "rowLevel" | "schemaPerTenant",
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
  if (config.strategy === "rowLevel") return undefined;
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
