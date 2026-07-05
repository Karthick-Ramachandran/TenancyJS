import { AsyncLocalStorage } from "node:async_hooks";

import type {
  MaybePromise,
  TenancyAdapter,
  TenancyAdapterValidationResult,
  TenantContext,
  TenantRecord,
} from "tenancyjs-core";
import { TenantContextError, unrestrictedRefusedMessage } from "tenancyjs-core";
import {
  PostgresStrategyValidationError,
  applyPostgresRowContext,
  createPostgresStrategyEngine,
  createTenantResourceCache,
  decideTenantDiscriminator,
  deferredDatabaseValidationResult,
  type PostgresExecutor,
  type PostgresSchemaStrategyEngine,
} from "tenancyjs-adapter-shared";
import type { TransactionClientContract } from "@adonisjs/lucid/types/database";
import type {
  LucidModel,
  LucidRow,
  ModelQueryBuilderContract,
} from "@adonisjs/lucid/types/model";

import { lucidCapabilities } from "./capabilities.js";
import {
  type LucidTenancyConfig,
  type LucidTenancyOptions,
  type LucidTenantConnection,
  type LucidTransactionProvider,
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

/**
 * Handed to the `run()` callback. Lucid scopes your models automatically via
 * hooks, so most code ignores this — it exists only to expose the escape hatch.
 */
export interface LucidScope {
  /**
   * The raw, tenant-scoped Lucid transaction client — full query freedom
   * (`rawQuery`, query builder, nested writes). Available **only** in a
   * database-enforced scope (database-per-tenant, tenant mode), where this
   * transaction runs on the tenant's own leased connection. Throws in any
   * facade-enforced scope (ADR-0033).
   */
  unrestricted(): TransactionClientContract;
}

export interface LucidTenancyAdapter<
  TTenant extends TenantRecord = TenantRecord,
> extends TenancyAdapter {
  readonly name: "lucid";
  readonly strategy: "rowLevel" | "schemaPerTenant" | "databasePerTenant";
  readonly config: LucidTenancyConfig<TTenant>;
  run<TResult>(
    callback: (scope: LucidScope) => MaybePromise<TResult>,
  ): Promise<TResult>;
  close(): Promise<void>;
}

interface TransactionScope {
  readonly transaction: TransactionClientContract;
  readonly scopeKey: string;
  readonly databaseEnforced: boolean;
}

/** Identity of the active tenant scope; a nested run() must resolve to the same one. */
function scopeKeyFor(context: TenantContext): string {
  return context.mode === "central" ? "central" : `tenant:${context.tenant.id}`;
}

export function createLucidTenancy<TTenant extends TenantRecord = TenantRecord>(
  options: LucidTenancyOptions<TTenant>,
): LucidTenancyAdapter<TTenant> {
  const config = defineLucidTenancyConfig(options);
  const schemaEngine = createSchemaEngine(config);
  const transactions = new AsyncLocalStorage<TransactionScope>();
  const connectionCache =
    config.strategy === "databasePerTenant"
      ? createTenantResourceCache<LucidTenantConnection>({
          capacity: config.maxConnections,
          destroy: (connection) => connection.destroy(),
        })
      : undefined;
  let validated = false;

  async function runWithTransaction<TResult>(
    provider: LucidTransactionProvider,
    context: TenantContext<TTenant>,
    callback: (scope: LucidScope) => MaybePromise<TResult>,
    databaseEnforced: boolean,
  ): Promise<TResult> {
    const scopeKey = scopeKeyFor(context);
    const execute = async (transaction: TransactionClientContract) => {
      if (config.strategy !== "databasePerTenant") {
        await setTransactionContext(transaction, context, schemaEngine);
      }
      const scope: LucidScope = {
        unrestricted() {
          // ADR-0033: the raw Lucid transaction runs on the tenant's own leased
          // connection only in a database-enforced scope. Fail closed otherwise
          // (row-level, schema-per-tenant, central) — there the connection is
          // shared and raw access could cross tenants.
          if (!databaseEnforced) {
            throw new LucidTenancyConfigurationError(
              unrestrictedRefusedMessage({
                adapter: "lucid",
                strategy: config.strategy,
                mode: context.mode,
              }),
            );
          }
          return transaction;
        },
      };
      return transactions.run(
        { transaction, scopeKey, databaseEnforced },
        async () => callback(scope),
      );
    };
    return provider.transaction(execute);
  }

  const adapter: LucidTenancyAdapter<TTenant> = Object.freeze({
    name: "lucid" as const,
    strategy: config.strategy,
    capabilities: lucidCapabilities(config.strategy),
    config,
    async validate() {
      // There is no finite tenant-database set to inspect at startup. Report
      // configuration validity without implying every tenant placement was
      // connected or inspected.
      if (config.strategy === "databasePerTenant") {
        validated = true;
        return deferredDatabaseValidationResult("TENANCY_LUCID", "Lucid");
      }
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
      callback: (scope: LucidScope) => MaybePromise<TResult>,
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
      if (parent !== undefined) {
        // Fail closed on cross-tenant nesting: reusing the parent transaction
        // for a different tenant/central scope would route this scope's queries
        // to the parent's schema or connection.
        if (parent.scopeKey !== scopeKeyFor(context)) {
          throw new LucidTenancyConfigurationError(
            "Cannot nest a Lucid run() for a different tenant or central scope inside an active tenant scope.",
          );
        }
        // Same-tenant nesting inherits the parent scope's enforcement tier.
        return runWithTransaction(
          parent.transaction,
          context,
          callback,
          parent.databaseEnforced,
        );
      }
      if (
        config.strategy === "databasePerTenant" &&
        context.mode === "tenant"
      ) {
        const placement = config.connection!(context.tenant);
        return connectionCache!.lease(
          context.tenant.id,
          placement.key,
          placement.create,
          // Only the leased per-tenant connection is database-enforced (ADR-0033).
          (connection) =>
            runWithTransaction(connection, context, callback, true),
        );
      }
      // Shared base connection (central mode / facade-enforced strategies).
      return runWithTransaction(config.database, context, callback, false);
    },
    async close() {
      if (connectionCache !== undefined) await connectionCache.close();
    },
  });

  for (const model of config.tenantModels) {
    registerModelHooks(model, config.manager, transactions, config.strategy);
  }
  return adapter;
}

function validationFailure(
  strategy: "rowLevel" | "schemaPerTenant" | "databasePerTenant",
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
  transactions: AsyncLocalStorage<TransactionScope>,
  strategy: "rowLevel" | "schemaPerTenant" | "databasePerTenant",
): void {
  const model = config.model;
  model.boot();
  model.before("find", (query) =>
    scopeQuery(
      query,
      config,
      manager.getContext(),
      transactions.getStore()?.transaction,
      "find",
      strategy,
    ),
  );
  model.before("fetch", (query) =>
    scopeQuery(
      query,
      config,
      manager.getContext(),
      transactions.getStore()?.transaction,
      "fetch",
      strategy,
    ),
  );
  model.before("paginate", ([countQuery, query]) => {
    const context = manager.getContext();
    const transaction = transactions.getStore()?.transaction;
    scopeQuery(countQuery, config, context, transaction, "paginate", strategy);
    scopeQuery(query, config, context, transaction, "paginate", strategy);
  });
  model.before("save", (row) =>
    scopePersistence(
      row,
      config,
      manager.getContext(),
      transactions.getStore()?.transaction,
      strategy,
    ),
  );
  model.before("delete", (row) => {
    const context = manager.getContext();
    const active = attachPersistence(
      row,
      config,
      context,
      transactions.getStore()?.transaction,
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
  strategy: "rowLevel" | "schemaPerTenant" | "databasePerTenant",
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
  strategy: "rowLevel" | "schemaPerTenant" | "databasePerTenant",
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
  if (strategy !== "rowLevel") return;
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
  if (config.strategy !== "schemaPerTenant") return undefined;
  return createPostgresStrategyEngine({
    codePrefix: "TENANCY_LUCID",
    adapterName: "Lucid",
    resolveSchema: config.schema!,
    centralSchema: config.centralSchema,
    ...(config.role === undefined ? {} : { resolveRole: config.role }),
    tenantTables: config.tenantModels.map((model) => model.table),
  });
}

function rejectCrossPlacement(
  context: TenantContext,
  strategy: "rowLevel" | "schemaPerTenant" | "databasePerTenant",
  model: string,
  operation: string,
): void {
  if (strategy !== "rowLevel" && context.mode === "central") {
    throw new LucidTenancyConfigurationError(
      `Lucid ${model}.${operation} cannot access a tenant model from a central ${strategy} context.`,
    );
  }
}
