import { AsyncLocalStorage } from "node:async_hooks";

import type {
  MaybePromise,
  TenancyAdapter,
  TenancyAdapterValidationResult,
  TenantContext,
  TenantRecord,
} from "@tenancyjs/core";
import { TenantContextError } from "@tenancyjs/core";
import type { TransactionClientContract } from "@adonisjs/lucid/types/database";
import type {
  LucidModel,
  LucidRow,
  ModelQueryBuilderContract,
} from "@adonisjs/lucid/types/model";

import { LUCID_ADAPTER_CAPABILITIES } from "./capabilities.js";
import {
  LUCID_CENTRAL_SETTING,
  LUCID_TENANT_SETTING,
  type LucidTenancyConfig,
  type LucidTenancyOptions,
  type NormalizedLucidTenantModelConfig,
  defineLucidTenancyConfig,
} from "./config.js";
import {
  LucidPolicyValidationError,
  LucidScopeError,
  LucidTenantFieldConflictError,
  LucidTenancyConfigurationError,
} from "./errors.js";
import { validateLucidPolicies } from "./validation.js";

const SET_CONTEXT_SQL = "select set_config(?, ?, true), set_config(?, ?, true)";
const VALIDATION_FAILURE: TenancyAdapterValidationResult = Object.freeze({
  valid: false,
  issues: Object.freeze([
    Object.freeze({
      code: "TENANCY_LUCID_POLICY_INTROSPECTION_FAILED",
      severity: "error" as const,
      message: "Lucid tenancy could not verify the PostgreSQL RLS contract.",
    }),
  ]),
});

export interface LucidTenancyAdapter<
  TTenant extends TenantRecord = TenantRecord,
> extends TenancyAdapter {
  readonly name: "lucid";
  readonly strategy: "rowLevel";
  readonly config: LucidTenancyConfig<TTenant>;
  run<TResult>(callback: () => MaybePromise<TResult>): Promise<TResult>;
}

export function createLucidTenancy<TTenant extends TenantRecord = TenantRecord>(
  options: LucidTenancyOptions<TTenant>,
): LucidTenancyAdapter<TTenant> {
  const config = defineLucidTenancyConfig(options);
  const transactions = new AsyncLocalStorage<TransactionClientContract>();
  let validated = false;

  const adapter: LucidTenancyAdapter<TTenant> = Object.freeze({
    name: "lucid" as const,
    strategy: "rowLevel" as const,
    capabilities: LUCID_ADAPTER_CAPABILITIES,
    config,
    async validate() {
      try {
        const result = await validateLucidPolicies(config);
        validated = result.valid;
        return result;
      } catch {
        validated = false;
        return VALIDATION_FAILURE;
      }
    },
    async run<TResult>(
      callback: () => MaybePromise<TResult>,
    ): Promise<TResult> {
      if (!validated) throw new LucidPolicyValidationError();
      if (typeof callback !== "function") {
        throw new LucidTenancyConfigurationError(
          "Protected Lucid execution requires a callback.",
        );
      }
      const context = config.manager.getContext();
      if (context === undefined) throw new TenantContextError("missing");
      const parent = transactions.getStore();
      const execute = async (transaction: TransactionClientContract) => {
        await setTransactionContext(transaction, context);
        return transactions.run(transaction, callback);
      };
      return parent === undefined
        ? config.database.transaction(execute)
        : parent.transaction(execute);
    },
  });

  for (const model of config.tenantModels) {
    registerModelHooks(model, config.manager, transactions);
  }
  return adapter;
}

function registerModelHooks<TTenant extends TenantRecord>(
  config: Readonly<NormalizedLucidTenantModelConfig>,
  manager: LucidTenancyConfig<TTenant>["manager"],
  transactions: AsyncLocalStorage<TransactionClientContract>,
): void {
  const model = config.model;
  model.boot();
  model.before("find", (query) =>
    scopeQuery(
      query,
      config,
      manager.getContext(),
      transactions.getStore(),
      "find",
    ),
  );
  model.before("fetch", (query) =>
    scopeQuery(
      query,
      config,
      manager.getContext(),
      transactions.getStore(),
      "fetch",
    ),
  );
  model.before("paginate", ([countQuery, query]) => {
    const context = manager.getContext();
    const transaction = transactions.getStore();
    scopeQuery(countQuery, config, context, transaction, "paginate");
    scopeQuery(query, config, context, transaction, "paginate");
  });
  model.before("save", (row) =>
    scopePersistence(
      row,
      config,
      manager.getContext(),
      transactions.getStore(),
    ),
  );
  model.before("delete", (row) => {
    attachPersistence(
      row,
      config,
      manager.getContext(),
      transactions.getStore(),
      "delete",
    );
  });
}

function scopeQuery(
  query: ModelQueryBuilderContract<LucidModel>,
  config: Readonly<NormalizedLucidTenantModelConfig>,
  context: TenantContext | undefined,
  transaction: TransactionClientContract | undefined,
  operation: string,
): void {
  const active = requireScope(config, context, transaction, operation);
  query.useTransaction(active.transaction);
  if (active.context.mode === "tenant") {
    query.where(config.tenantColumn, active.context.tenant.id);
  }
}

function scopePersistence(
  row: LucidRow,
  config: Readonly<NormalizedLucidTenantModelConfig>,
  context: TenantContext | undefined,
  transaction: TransactionClientContract | undefined,
): void {
  const operation = row.$isNew ? "create" : "update";
  const active = attachPersistence(
    row,
    config,
    context,
    transaction,
    operation,
  );
  if (active.context.mode !== "tenant") return;
  const supplied = row.$getAttribute(config.tenantAttribute);
  if (row.$isNew) {
    if (supplied !== undefined && supplied !== active.context.tenant.id) {
      throw new LucidTenantFieldConflictError(config.modelName, operation);
    }
    row.$setAttribute(config.tenantAttribute, active.context.tenant.id);
    return;
  }
  if (Object.hasOwn(row.$dirty, config.tenantAttribute)) {
    throw new LucidTenantFieldConflictError(config.modelName, operation);
  }
}

function attachPersistence(
  row: LucidRow,
  config: Readonly<NormalizedLucidTenantModelConfig>,
  context: TenantContext | undefined,
  transaction: TransactionClientContract | undefined,
  operation: string,
): Readonly<{
  context: TenantContext;
  transaction: TransactionClientContract;
}> {
  const active = requireScope(config, context, transaction, operation);
  row.useTransaction(active.transaction);
  return active;
}

function requireScope(
  config: Readonly<NormalizedLucidTenantModelConfig>,
  context: TenantContext | undefined,
  transaction: TransactionClientContract | undefined,
  operation: string,
): Readonly<{
  context: TenantContext;
  transaction: TransactionClientContract;
}> {
  if (context === undefined || transaction === undefined) {
    throw new LucidScopeError(config.modelName, operation);
  }
  return Object.freeze({ context, transaction });
}

async function setTransactionContext(
  transaction: TransactionClientContract,
  context: TenantContext,
): Promise<void> {
  await transaction.rawQuery(SET_CONTEXT_SQL, [
    LUCID_TENANT_SETTING,
    context.mode === "tenant" ? context.tenant.id : "",
    LUCID_CENTRAL_SETTING,
    context.mode === "central" ? "true" : "false",
  ]);
}
