import { AsyncLocalStorage } from "node:async_hooks";

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
  decideTenantDiscriminator,
  type PostgresExecutor,
  type PostgresSchemaStrategyEngine,
} from "@tenancyjs/adapter-shared";
import type { TransactionClientContract } from "@adonisjs/lucid/types/database";
import type {
  LucidModel,
  LucidRow,
  ModelQueryBuilderContract,
} from "@adonisjs/lucid/types/model";

import { LUCID_ADAPTER_CAPABILITIES } from "./capabilities.js";
import {
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

export interface LucidTenancyAdapter<
  TTenant extends TenantRecord = TenantRecord,
> extends TenancyAdapter {
  readonly name: "lucid";
  readonly strategy: "rowLevel" | "schemaPerTenant";
  readonly config: LucidTenancyConfig<TTenant>;
  run<TResult>(callback: () => MaybePromise<TResult>): Promise<TResult>;
}

export function createLucidTenancy<TTenant extends TenantRecord = TenantRecord>(
  options: LucidTenancyOptions<TTenant>,
): LucidTenancyAdapter<TTenant> {
  const config = defineLucidTenancyConfig(options);
  const schemaEngine = createSchemaEngine(config);
  const transactions = new AsyncLocalStorage<TransactionClientContract>();
  let validated = false;

  const adapter: LucidTenancyAdapter<TTenant> = Object.freeze({
    name: "lucid" as const,
    strategy: config.strategy,
    capabilities: LUCID_ADAPTER_CAPABILITIES,
    config,
    async validate() {
      try {
        const result =
          config.strategy === "rowLevel"
            ? await validateLucidPolicies(config)
            : await schemaEngine!.validate(lucidExecutor(config.database));
        validated = result.valid;
        return result;
      } catch {
        validated = false;
        return validationFailure(config.strategy);
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
        await setTransactionContext(transaction, context, schemaEngine);
        return transactions.run(transaction, async () => await callback());
      };
      return parent === undefined
        ? config.database.transaction(execute)
        : parent.transaction(execute);
    },
  });

  for (const model of config.tenantModels) {
    registerModelHooks(model, config.manager, transactions, config.strategy);
  }
  return adapter;
}

function validationFailure(
  strategy: "rowLevel" | "schemaPerTenant",
): TenancyAdapterValidationResult {
  return Object.freeze({
    valid: false,
    issues: Object.freeze([
      Object.freeze({
        code: "TENANCY_LUCID_POLICY_INTROSPECTION_FAILED",
        severity: "error" as const,
        message:
          strategy === "rowLevel"
            ? "Lucid tenancy could not verify the PostgreSQL RLS contract."
            : "Lucid tenancy could not verify the PostgreSQL schema isolation contract.",
      }),
    ]),
  });
}

function registerModelHooks<TTenant extends TenantRecord>(
  config: Readonly<NormalizedLucidTenantModelConfig>,
  manager: LucidTenancyConfig<TTenant>["manager"],
  transactions: AsyncLocalStorage<TransactionClientContract>,
  strategy: "rowLevel" | "schemaPerTenant",
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
      strategy,
    ),
  );
  model.before("fetch", (query) =>
    scopeQuery(
      query,
      config,
      manager.getContext(),
      transactions.getStore(),
      "fetch",
      strategy,
    ),
  );
  model.before("paginate", ([countQuery, query]) => {
    const context = manager.getContext();
    const transaction = transactions.getStore();
    scopeQuery(countQuery, config, context, transaction, "paginate", strategy);
    scopeQuery(query, config, context, transaction, "paginate", strategy);
  });
  model.before("save", (row) =>
    scopePersistence(
      row,
      config,
      manager.getContext(),
      transactions.getStore(),
      strategy,
    ),
  );
  model.before("delete", (row) => {
    const context = manager.getContext();
    const active = attachPersistence(
      row,
      config,
      context,
      transactions.getStore(),
      "delete",
    );
    rejectCrossPlacement(active.context, strategy, config.modelName, "delete");
  });
}

function scopeQuery(
  query: ModelQueryBuilderContract<LucidModel>,
  config: Readonly<NormalizedLucidTenantModelConfig>,
  context: TenantContext | undefined,
  transaction: TransactionClientContract | undefined,
  operation: string,
  strategy: "rowLevel" | "schemaPerTenant",
): void {
  const active = requireScope(config, context, transaction, operation);
  rejectCrossPlacement(active.context, strategy, config.modelName, operation);
  query.useTransaction(active.transaction);
  if (strategy === "rowLevel" && active.context.mode === "tenant") {
    query.where(config.tenantColumn, active.context.tenant.id);
  }
}

function scopePersistence(
  row: LucidRow,
  config: Readonly<NormalizedLucidTenantModelConfig>,
  context: TenantContext | undefined,
  transaction: TransactionClientContract | undefined,
  strategy: "rowLevel" | "schemaPerTenant",
): void {
  const operation = row.$isNew ? "create" : "update";
  const active = attachPersistence(
    row,
    config,
    context,
    transaction,
    operation,
  );
  rejectCrossPlacement(active.context, strategy, config.modelName, operation);
  if (strategy === "schemaPerTenant") return;
  if (active.context.mode !== "tenant") return;
  const supplied = row.$getAttribute(config.tenantAttribute);
  const decision = decideTenantDiscriminator(
    active.context.tenant.id,
    row.$isNew ? "create" : "update",
    row.$isNew
      ? supplied !== undefined
      : Object.hasOwn(row.$dirty, config.tenantAttribute),
    supplied,
  );
  if (decision.kind === "reject") {
    throw new LucidTenantFieldConflictError(config.modelName, operation);
  }
  if (decision.kind === "inject") {
    row.$setAttribute(config.tenantAttribute, decision.value);
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
  schemaEngine: PostgresSchemaStrategyEngine | undefined,
): Promise<void> {
  const execute = lucidExecutor(transaction);
  try {
    if (schemaEngine === undefined) {
      await applyPostgresRowContext(execute, context);
    } else {
      await schemaEngine.applyContext(execute, context);
    }
  } catch (error) {
    if (error instanceof PostgresStrategyValidationError) {
      throw new LucidPolicyValidationError();
    }
    throw error;
  }
}

type LucidRawClient =
  | Pick<LucidTenancyConfig["database"], "rawQuery">
  | Pick<TransactionClientContract, "rawQuery">;
type LucidRawBindings = NonNullable<
  Parameters<LucidTenancyConfig["database"]["rawQuery"]>[1]
>;

function lucidExecutor(client: LucidRawClient): PostgresExecutor {
  return (sql, bindings) =>
    bindings === undefined
      ? Promise.resolve(client.rawQuery(sql) as Promise<unknown>)
      : Promise.resolve(
          client.rawQuery(sql, [
            ...bindings,
          ] as LucidRawBindings) as Promise<unknown>,
        );
}

function createSchemaEngine<TTenant extends TenantRecord>(
  config: LucidTenancyConfig<TTenant>,
): PostgresSchemaStrategyEngine<TTenant> | undefined {
  if (config.strategy === "rowLevel") return undefined;
  return createPostgresStrategyEngine({
    codePrefix: "TENANCY_LUCID",
    adapterName: "Lucid",
    resolveSchema: config.schema!,
    centralSchema: config.centralSchema,
    tenantTables: config.tenantModels.map((model) => model.table),
  });
}

function rejectCrossPlacement(
  context: TenantContext,
  strategy: "rowLevel" | "schemaPerTenant",
  model: string,
  operation: string,
): void {
  if (strategy === "schemaPerTenant" && context.mode === "central") {
    throw new LucidTenancyConfigurationError(
      `Lucid ${model}.${operation} cannot access a tenant model from central schema-per-tenant context.`,
    );
  }
}
