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
  deferredDatabaseValidationResult,
  decideTenantDiscriminator,
  validatePostgresRlsPolicies,
  type PostgresExecutor,
  type PostgresSchemaStrategyEngine,
  type TenantResourceCache,
} from "tenancyjs-adapter-shared";
import {
  QueryTypes,
  type Model,
  type ModelStatic,
  type Sequelize,
  type Transaction,
} from "sequelize";

import { SEQUELIZE_ADAPTER_CAPABILITIES } from "./capabilities.js";
import {
  defineSequelizeTenancyConfig,
  matchesSequelizeDialect,
  type NormalizedSequelizeTenantModelConfig,
  type SequelizeModelPolicy,
  type SequelizeTenancyConfig,
  type SequelizeTenancyOptions,
} from "./config.js";
import {
  SequelizeModelUnregisteredError,
  SequelizePolicyValidationError,
  SequelizeTenantFieldConflictError,
  SequelizeTenancyConfigurationError,
  SequelizeUnsafeCriteriaError,
} from "./errors.js";
import type {
  ProtectedSequelizeClient,
  ProtectedSequelizeModel,
  SequelizeCriteria,
  SequelizeValues,
} from "./types.js";

export interface SequelizeTenancyAdapter<
  TTenant extends TenantRecord = TenantRecord,
> extends TenancyAdapter {
  readonly name: "sequelize";
  readonly strategy: "rowLevel" | "schemaPerTenant" | "databasePerTenant";
  readonly config: SequelizeTenancyConfig<TTenant>;
  run<TResult>(
    callback: (client: ProtectedSequelizeClient) => MaybePromise<TResult>,
  ): Promise<TResult>;
  close(): Promise<void>;
}

export function createSequelizeTenancy<
  TTenant extends TenantRecord = TenantRecord,
>(options: SequelizeTenancyOptions<TTenant>): SequelizeTenancyAdapter<TTenant> {
  const config = defineSequelizeTenancyConfig(options);
  const schemaEngine = createSchemaEngine(config);
  const connectionCache: TenantResourceCache<Sequelize> | undefined =
    config.strategy === "databasePerTenant"
      ? createTenantResourceCache<Sequelize>({
          capacity: config.maxConnections,
          destroy: (sequelize) => sequelize.close(),
        })
      : undefined;
  let validated = false;

  async function validate(): Promise<TenancyAdapterValidationResult> {
    if (config.strategy === "databasePerTenant") {
      validated = true;
      return deferredDatabaseValidationResult("TENANCY_SEQUELIZE", "Sequelize");
    }
    if (config.strategy === "rowLevel" && config.dialect === "mysql") {
      validated = true;
      return adapterEnforcedRowValidationResult(
        "TENANCY_SEQUELIZE",
        "Sequelize",
        "MySQL",
      );
    }
    try {
      const result =
        config.strategy === "rowLevel"
          ? await validatePostgresRlsPolicies({
              codePrefix: "TENANCY_SEQUELIZE",
              adapterName: "Sequelize",
              execute: sequelizeExecutor(config.sequelize),
              tables: config.tenantModels.map((entry) => ({
                schema: entry.schema!,
                table: entry.table,
                qualifiedName: entry.qualifiedName,
                policyName: entry.policyName,
              })),
            })
          : await schemaEngine!.validate(sequelizeExecutor(config.sequelize));
      validated = result.valid;
      return result;
    } catch {
      validated = false;
      return Object.freeze({
        valid: false,
        issues: Object.freeze([
          Object.freeze({
            code: "TENANCY_SEQUELIZE_POLICY_INTROSPECTION_FAILED",
            severity: "error" as const,
            message:
              "Sequelize tenancy could not verify the PostgreSQL RLS contract.",
          }),
        ]),
      });
    }
  }

  async function run<TResult>(
    callback: (client: ProtectedSequelizeClient) => MaybePromise<TResult>,
  ): Promise<TResult> {
    if (!validated) throw new SequelizePolicyValidationError();
    if (typeof callback !== "function") {
      throw new SequelizeTenancyConfigurationError(
        "Sequelize protected execution requires a callback.",
      );
    }
    const context = config.manager.getContext();
    if (context === undefined) throw new TenantContextError("missing");
    const runScope = (sequelize: Sequelize) => {
      if (!matchesSequelizeDialect(sequelize.getDialect(), config.dialect))
        throw new SequelizeTenancyConfigurationError(
          "Sequelize tenant instance dialect does not match the base configuration.",
        );
      return sequelize.transaction(async (transaction) => {
        if (config.strategy === "rowLevel" && config.dialect === "postgresql") {
          await applyPostgresRowContext(
            sequelizeExecutor(sequelize, transaction),
            context,
          );
        } else if (config.strategy === "schemaPerTenant") {
          await schemaEngine!.applyContext(
            sequelizeExecutor(sequelize, transaction),
            context,
          );
        }
        return callback(
          createProtectedClient(
            config,
            sequelize,
            transaction,
            context,
            config.strategy,
          ),
        );
      });
    };
    if (config.strategy === "databasePerTenant" && context.mode === "tenant") {
      const placement = config.connection!(context.tenant);
      return connectionCache!.lease(
        context.tenant.id,
        placement.key,
        placement.create,
        runScope,
      );
    }
    return runScope(config.sequelize);
  }

  return Object.freeze({
    name: "sequelize" as const,
    strategy: config.strategy,
    capabilities: SEQUELIZE_ADAPTER_CAPABILITIES,
    config,
    validate,
    run,
    async close() {
      await connectionCache?.close();
    },
  });
}

function createProtectedClient<TTenant extends TenantRecord>(
  config: SequelizeTenancyConfig<TTenant>,
  sequelize: Sequelize,
  transaction: Transaction,
  context: TenantContext<TTenant>,
  strategy: "rowLevel" | "schemaPerTenant" | "databasePerTenant",
): ProtectedSequelizeClient {
  return Object.freeze({
    model(model: ModelStatic<Model>) {
      const policy = config.classify(model);
      if (policy === undefined) throw new SequelizeModelUnregisteredError();
      if (
        strategy !== "rowLevel" &&
        ((context.mode === "tenant" && policy.kind === "central") ||
          (context.mode === "central" && policy.kind === "tenant"))
      ) {
        throw new SequelizeUnsafeCriteriaError();
      }
      const boundModel =
        strategy === "databasePerTenant"
          ? (sequelize.models[model.name] as ModelStatic<Model> | undefined)
          : model;
      if (boundModel === undefined) throw new SequelizeModelUnregisteredError();
      return createProtectedModel(
        boundModel,
        policy,
        transaction,
        context,
        strategy,
      );
    },
  });
}

function createProtectedModel(
  model: ModelStatic<Model>,
  policy: SequelizeModelPolicy,
  transaction: Transaction,
  context: TenantContext,
  strategy: "rowLevel" | "schemaPerTenant" | "databasePerTenant",
): ProtectedSequelizeModel {
  const tenant =
    strategy === "rowLevel" && policy.kind === "tenant"
      ? policy.config
      : undefined;
  return Object.freeze({
    async findAll(where: SequelizeCriteria = {}) {
      const rows = await model.findAll({
        where: scopedWhere(where, tenant, context),
        transaction,
        raw: true,
      });
      return Object.freeze(
        rows.map((row) => Object.freeze({ ...(row as unknown as object) })),
      );
    },
    async findOne(where: SequelizeCriteria) {
      const row = await model.findOne({
        where: scopedWhere(where, tenant, context),
        transaction,
        raw: true,
      });
      return row === null
        ? null
        : Object.freeze({ ...(row as unknown as object) });
    },
    count(where: SequelizeCriteria = {}) {
      return model.count({
        where: scopedWhere(where, tenant, context),
        transaction,
      });
    },
    async create(values: SequelizeValues) {
      await model.create(scopedValues(values, tenant, context, "create"), {
        transaction,
      });
    },
    async createMany(values: readonly SequelizeValues[]) {
      if (!Array.isArray(values) || values.length === 0)
        throw new SequelizeUnsafeCriteriaError();
      await model.bulkCreate(
        values.map((value) => scopedValues(value, tenant, context, "create")),
        { transaction },
      );
    },
    async update(where: SequelizeCriteria, values: SequelizeValues) {
      const [affected] = await model.update(
        scopedValues(values, tenant, context, "update"),
        { where: scopedWhere(where, tenant, context), transaction },
      );
      return affected;
    },
    delete(where: SequelizeCriteria) {
      return model.destroy({
        where: scopedWhere(where, tenant, context),
        transaction,
      });
    },
  });
}

function scopedWhere(
  where: SequelizeCriteria,
  policy: NormalizedSequelizeTenantModelConfig | undefined,
  context: TenantContext,
): Record<string, unknown> {
  assertPlainScalars(where);
  const result: Record<string, unknown> = { ...where };
  if (policy !== undefined && context.mode === "tenant") {
    if (
      Object.hasOwn(result, policy.tenantAttribute) &&
      result[policy.tenantAttribute] !== context.tenant.id
    ) {
      throw new SequelizeTenantFieldConflictError("filter");
    }
    result[policy.tenantAttribute] = context.tenant.id;
  }
  return result;
}

function scopedValues(
  values: SequelizeValues,
  policy: NormalizedSequelizeTenantModelConfig | undefined,
  context: TenantContext,
  operation: "create" | "update",
): Record<string, unknown> {
  assertPlainRecord(values);
  const result: Record<string, unknown> = { ...values };
  if (policy === undefined) return result;
  const decision = decideTenantDiscriminator(
    context.mode === "tenant" ? context.tenant.id : undefined,
    operation,
    Object.hasOwn(result, policy.tenantAttribute),
    result[policy.tenantAttribute],
  );
  if (decision.kind === "reject")
    throw new SequelizeTenantFieldConflictError(operation);
  if (decision.kind === "inject")
    result[policy.tenantAttribute] = decision.value;
  return result;
}

function assertPlainScalars(
  value: unknown,
): asserts value is SequelizeCriteria {
  assertPlainRecord(value);
  for (const entry of Object.values(value)) {
    if (
      entry !== null &&
      typeof entry !== "string" &&
      typeof entry !== "number" &&
      typeof entry !== "boolean" &&
      !(entry instanceof Date)
    ) {
      throw new SequelizeUnsafeCriteriaError();
    }
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
    // Reject Symbol-keyed operators (Sequelize `Op.*`): they are invisible to
    // Object.values/keys, so an unscoped `{ [Op.or]: [...] }` would otherwise
    // survive the plain-scalar guard.
    Object.getOwnPropertySymbols(value).length > 0
  ) {
    throw new SequelizeUnsafeCriteriaError();
  }
}

function sequelizeExecutor(
  sequelize: Sequelize,
  transaction?: Transaction,
): PostgresExecutor {
  return async (sql, bindings) => {
    let index = 0;
    const query = sql.replaceAll("?", () => `$${++index}`);
    const rows = await sequelize.query(query, {
      bind: bindings === undefined ? [] : [...bindings],
      type: QueryTypes.SELECT,
      ...(transaction === undefined ? {} : { transaction }),
    });
    return { rows };
  };
}

function createSchemaEngine<TTenant extends TenantRecord>(
  config: SequelizeTenancyConfig<TTenant>,
): PostgresSchemaStrategyEngine<TTenant> | undefined {
  if (config.strategy !== "schemaPerTenant") return undefined;
  return createPostgresStrategyEngine({
    codePrefix: "TENANCY_SEQUELIZE",
    adapterName: "Sequelize",
    resolveSchema: config.schema!,
    centralSchema: config.centralSchema,
    ...(config.role === undefined ? {} : { resolveRole: config.role }),
    tenantTables: config.tenantModels.map((entry) => entry.table),
    centralTables: [],
  });
}
