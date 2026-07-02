import type {
  MaybePromise,
  TenancyAdapter,
  TenancyAdapterValidationResult,
  TenantRecord,
} from "@tenancyjs/core";
import { TenantContextError } from "@tenancyjs/core";
import type { Knex } from "knex";

import { KNEX_ADAPTER_CAPABILITIES } from "./capabilities.js";
import {
  KNEX_CENTRAL_SETTING,
  KNEX_TENANT_SETTING,
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

const SET_CONTEXT_SQL = "select set_config(?, ?, true), set_config(?, ?, true)";
const VALIDATION_FAILURE: TenancyAdapterValidationResult = Object.freeze({
  valid: false,
  issues: Object.freeze([
    Object.freeze({
      code: "TENANCY_KNEX_POLICY_INTROSPECTION_FAILED",
      severity: "error" as const,
      message: "Knex tenancy could not verify the PostgreSQL RLS contract.",
    }),
  ]),
});

export interface KnexTenancyAdapter<
  TTenant extends TenantRecord = TenantRecord,
> extends TenancyAdapter {
  readonly name: "knex";
  readonly strategy: "rowLevel";
  readonly config: KnexTenancyConfig<TTenant>;
  run<TResult>(
    callback: (client: ProtectedKnexClient) => MaybePromise<TResult>,
  ): Promise<TResult>;
}

export function createKnexTenancy<TTenant extends TenantRecord = TenantRecord>(
  options: KnexTenancyOptions<TTenant>,
): KnexTenancyAdapter<TTenant> {
  const config = defineKnexTenancyConfig(options);
  let validated = false;

  async function validate(): Promise<TenancyAdapterValidationResult> {
    try {
      const result = await validateKnexPolicies(config);
      validated = result.valid;
      return result;
    } catch {
      validated = false;
      return VALIDATION_FAILURE;
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
      await setTransactionContext(transaction, context);
      const createSavepoint = async <TSavepoint>(
        parent: Knex.Transaction,
        savepointCallback: (savepoint: Knex.Transaction) => Promise<TSavepoint>,
      ): Promise<TSavepoint> =>
        parent.transaction(async (savepoint) => {
          await setTransactionContext(savepoint, context);
          return savepointCallback(savepoint);
        });
      const client = createProtectedKnexClient(
        transaction,
        context,
        (name) => classifyKnexTable(config, name),
        createSavepoint,
      );
      return callback(client);
    });
  }

  return Object.freeze({
    name: "knex",
    strategy: "rowLevel",
    capabilities: KNEX_ADAPTER_CAPABILITIES,
    config,
    validate,
    run,
  });
}

async function setTransactionContext(
  transaction: Knex.Transaction,
  context: NonNullable<ReturnType<KnexTenancyConfig["manager"]["getContext"]>>,
): Promise<void> {
  await transaction.raw(SET_CONTEXT_SQL, [
    KNEX_TENANT_SETTING,
    context.mode === "tenant" ? context.tenant.id : "",
    KNEX_CENTRAL_SETTING,
    context.mode === "central" ? "true" : "false",
  ]);
}
