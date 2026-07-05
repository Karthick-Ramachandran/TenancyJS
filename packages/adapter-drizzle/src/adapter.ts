import type {
  MaybePromise,
  TenancyAdapter,
  TenancyAdapterValidationResult,
  TenantContext,
  TenantRecord,
} from "tenancyjs-core";
import { TenantContextError } from "tenancyjs-core";
import {
  adapterEnforcedRowValidationResult,
  applyPostgresRowContext,
  createPostgresStrategyEngine,
  createTenantResourceCache,
  decideTenantDiscriminator,
  deferredDatabaseValidationResult,
  validatePostgresRlsPolicies,
  type PostgresSchemaStrategyEngine,
  type TenantResourceCache,
} from "tenancyjs-adapter-shared";

import type {
  DrizzleDatabaseBinding,
  DrizzleSessionBinding,
} from "./binding.js";
import { DRIZZLE_ADAPTER_CAPABILITIES } from "./capabilities.js";
import {
  defineDrizzleTenancyConfig,
  type DrizzleTablePolicy,
  type DrizzleTenancyConfig,
  type DrizzleTenancyOptions,
  type NormalizedDrizzleTenantTableConfig,
} from "./config.js";
import {
  DrizzlePolicyValidationError,
  DrizzleTableUnregisteredError,
  DrizzleTenantFieldConflictError,
  DrizzleTenancyConfigurationError,
  DrizzleUnsafeCriteriaError,
} from "./errors.js";
import type {
  DrizzleCriteria,
  DrizzleTable,
  DrizzleValues,
  ProtectedDrizzleClient,
  ProtectedDrizzleTable,
} from "./types.js";

export interface DrizzleTenancyAdapter<
  TTenant extends TenantRecord = TenantRecord,
> extends TenancyAdapter {
  readonly name: "drizzle";
  readonly strategy: "rowLevel" | "schemaPerTenant" | "databasePerTenant";
  readonly config: DrizzleTenancyConfig<TTenant>;
  run<TResult>(
    callback: (client: ProtectedDrizzleClient) => MaybePromise<TResult>,
  ): Promise<TResult>;
  close(): Promise<void>;
}

export function createDrizzleTenancy<
  TTenant extends TenantRecord = TenantRecord,
>(options: DrizzleTenancyOptions<TTenant>): DrizzleTenancyAdapter<TTenant> {
  const config = defineDrizzleTenancyConfig(options);
  const schemaEngine = createSchemaEngine(config);
  const cache: TenantResourceCache<DrizzleDatabaseBinding> | undefined =
    config.strategy === "databasePerTenant"
      ? createTenantResourceCache({
          capacity: config.maxConnections,
          destroy: (binding) => binding.close(),
        })
      : undefined;
  let validated = false;

  async function validate(): Promise<TenancyAdapterValidationResult> {
    if (config.strategy === "databasePerTenant") {
      validated = true;
      return deferredDatabaseValidationResult("TENANCY_DRIZZLE", "Drizzle");
    }
    if (config.strategy === "rowLevel" && config.database.dialect === "mysql") {
      validated = true;
      return adapterEnforcedRowValidationResult(
        "TENANCY_DRIZZLE",
        "Drizzle",
        "MySQL",
      );
    }
    try {
      const executor = config.database.postgresExecutor;
      if (executor === undefined)
        throw new DrizzleTenancyConfigurationError(
          "Drizzle PostgreSQL execution is unavailable.",
        );
      const result =
        config.strategy === "rowLevel"
          ? await validatePostgresRlsPolicies({
              codePrefix: "TENANCY_DRIZZLE",
              adapterName: "Drizzle",
              execute: executor,
              tables: config.tenantTables.map((entry) => ({
                schema: entry.schema ?? "public",
                table: entry.name,
                qualifiedName: entry.qualifiedName,
                policyName: entry.policyName,
              })),
            })
          : await schemaEngine!.validate(executor);
      validated = result.valid;
      return result;
    } catch {
      validated = false;
      return Object.freeze({
        valid: false,
        issues: Object.freeze([
          Object.freeze({
            code: "TENANCY_DRIZZLE_POLICY_INTROSPECTION_FAILED",
            severity: "error" as const,
            message:
              "Drizzle tenancy could not verify the PostgreSQL isolation contract.",
          }),
        ]),
      });
    }
  }

  async function run<TResult>(
    callback: (client: ProtectedDrizzleClient) => MaybePromise<TResult>,
  ): Promise<TResult> {
    if (!validated) throw new DrizzlePolicyValidationError();
    if (typeof callback !== "function")
      throw new DrizzleTenancyConfigurationError(
        "Drizzle protected execution requires a callback.",
      );
    const context = config.manager.getContext();
    if (context === undefined) throw new TenantContextError("missing");
    const runScope = (database: DrizzleDatabaseBinding) => {
      if (database.dialect !== config.database.dialect)
        throw new DrizzleTenancyConfigurationError(
          "Drizzle tenant database dialect does not match the base binding.",
        );
      return database.transaction(async (session) => {
        if (
          config.strategy === "rowLevel" &&
          database.dialect === "postgresql"
        ) {
          if (session.postgresExecutor === undefined)
            throw new DrizzleTenancyConfigurationError(
              "Drizzle PostgreSQL transaction execution is unavailable.",
            );
          await applyPostgresRowContext(session.postgresExecutor, context);
        } else if (config.strategy === "schemaPerTenant") {
          if (session.postgresExecutor === undefined)
            throw new DrizzleTenancyConfigurationError(
              "Drizzle PostgreSQL transaction execution is unavailable.",
            );
          await schemaEngine!.applyContext(session.postgresExecutor, context);
        }
        return callback(createProtectedClient(config, session, context));
      });
    };
    if (config.strategy === "databasePerTenant" && context.mode === "tenant") {
      const placement = config.connection!(context.tenant);
      return cache!.lease(
        context.tenant.id,
        placement.key,
        async () => {
          const binding = await placement.create();
          if (binding.dialect !== config.database.dialect)
            throw new DrizzleTenancyConfigurationError(
              "Drizzle tenant database dialect does not match the base binding.",
            );
          if (!binding.ownsLifecycle)
            throw new DrizzleTenancyConfigurationError(
              "Drizzle tenant database bindings require a close callback.",
            );
          return binding;
        },
        runScope,
      );
    }
    return runScope(config.database);
  }

  return Object.freeze({
    name: "drizzle" as const,
    strategy: config.strategy,
    capabilities: DRIZZLE_ADAPTER_CAPABILITIES,
    config,
    validate,
    run,
    async close() {
      await cache?.close();
    },
  });
}

function createProtectedClient<TTenant extends TenantRecord>(
  config: DrizzleTenancyConfig<TTenant>,
  session: DrizzleSessionBinding,
  context: TenantContext<TTenant>,
): ProtectedDrizzleClient {
  return Object.freeze({
    table(table: DrizzleTable) {
      const policy = config.classify(table);
      if (policy === undefined) throw new DrizzleTableUnregisteredError();
      if (
        config.strategy !== "rowLevel" &&
        ((context.mode === "tenant" && policy.kind === "central") ||
          (context.mode === "central" && policy.kind === "tenant"))
      )
        throw new DrizzleUnsafeCriteriaError();
      return protectedTable(table, policy, session, context, config.strategy);
    },
  });
}

function protectedTable(
  table: DrizzleTable,
  policy: DrizzleTablePolicy,
  session: DrizzleSessionBinding,
  context: TenantContext,
  strategy: "rowLevel" | "schemaPerTenant" | "databasePerTenant",
): ProtectedDrizzleTable {
  const tenant =
    strategy === "rowLevel" && policy.kind === "tenant"
      ? policy.config
      : undefined;
  return Object.freeze({
    findMany: (where: DrizzleCriteria = {}) =>
      session.findMany(table, scopedWhere(where, tenant, context)),
    async findOne(where: DrizzleCriteria) {
      const rows = await session.findMany(
        table,
        scopedWhere(where, tenant, context),
      );
      return rows[0] ?? null;
    },
    count: (where: DrizzleCriteria = {}) =>
      session.count(table, scopedWhere(where, tenant, context)),
    create: (values: DrizzleValues) =>
      session.create(table, [scopedValues(values, tenant, context, "create")]),
    createMany(values: readonly DrizzleValues[]) {
      if (!Array.isArray(values) || values.length === 0)
        throw new DrizzleUnsafeCriteriaError();
      return session.create(
        table,
        values.map((value) => scopedValues(value, tenant, context, "create")),
      );
    },
    update: (where: DrizzleCriteria, values: DrizzleValues) =>
      session.update(
        table,
        scopedWhere(where, tenant, context),
        scopedValues(values, tenant, context, "update"),
      ),
    delete: (where: DrizzleCriteria) =>
      session.delete(table, scopedWhere(where, tenant, context)),
  });
}

function scopedWhere(
  where: DrizzleCriteria,
  policy: NormalizedDrizzleTenantTableConfig | undefined,
  context: TenantContext,
): DrizzleCriteria {
  assertPlainScalars(where);
  const result: Record<string, DrizzleCriteria[string]> = { ...where };
  if (policy !== undefined && context.mode === "tenant") {
    if (
      Object.hasOwn(result, policy.tenantProperty) &&
      result[policy.tenantProperty] !== context.tenant.id
    )
      throw new DrizzleTenantFieldConflictError("filter");
    result[policy.tenantProperty] = context.tenant.id;
  }
  return result;
}

function scopedValues(
  values: DrizzleValues,
  policy: NormalizedDrizzleTenantTableConfig | undefined,
  context: TenantContext,
  operation: "create" | "update",
): DrizzleValues {
  assertPlainRecord(values);
  const result: Record<string, unknown> = { ...values };
  if (policy === undefined) return result;
  const decision = decideTenantDiscriminator(
    context.mode === "tenant" ? context.tenant.id : undefined,
    operation,
    Object.hasOwn(result, policy.tenantProperty),
    result[policy.tenantProperty],
  );
  if (decision.kind === "reject")
    throw new DrizzleTenantFieldConflictError(operation);
  if (decision.kind === "inject")
    result[policy.tenantProperty] = decision.value;
  return result;
}

function assertPlainScalars(value: unknown): asserts value is DrizzleCriteria {
  assertPlainRecord(value);
  for (const entry of Object.values(value)) {
    if (
      entry !== null &&
      typeof entry !== "string" &&
      typeof entry !== "number" &&
      typeof entry !== "boolean" &&
      !(entry instanceof Date)
    )
      throw new DrizzleUnsafeCriteriaError();
  }
}

function assertPlainRecord(
  value: unknown,
): asserts value is Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null) ||
    Object.getOwnPropertySymbols(value).length > 0
  )
    throw new DrizzleUnsafeCriteriaError();
}

function createSchemaEngine<TTenant extends TenantRecord>(
  config: DrizzleTenancyConfig<TTenant>,
): PostgresSchemaStrategyEngine<TTenant> | undefined {
  if (config.strategy !== "schemaPerTenant") return undefined;
  return createPostgresStrategyEngine({
    codePrefix: "TENANCY_DRIZZLE",
    adapterName: "Drizzle",
    resolveSchema: config.schema!,
    centralSchema: config.centralSchema,
    ...(config.role === undefined ? {} : { resolveRole: config.role }),
    tenantTables: config.tenantTables.map((entry) => entry.name),
    centralTables: [],
  });
}
