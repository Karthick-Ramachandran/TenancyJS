import type {
  MaybePromise,
  TenancyAdapter,
  TenancyAdapterValidationResult,
  TenantContext,
  TenantRecord,
} from "@tenancyjs/core";
import { TenantContextError } from "@tenancyjs/core";
import {
  applyPostgresRowContext,
  decideTenantDiscriminator,
  validatePostgresRlsPolicies,
  type PostgresExecutor,
} from "@tenancyjs/adapter-shared";
import {
  QueryTypes,
  type Model,
  type ModelStatic,
  type Transaction,
} from "sequelize";

import { SEQUELIZE_ADAPTER_CAPABILITIES } from "./capabilities.js";
import {
  defineSequelizeTenancyConfig,
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
  readonly strategy: "rowLevel";
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
  let validated = false;

  async function validate(): Promise<TenancyAdapterValidationResult> {
    try {
      const result = await validatePostgresRlsPolicies({
        codePrefix: "TENANCY_SEQUELIZE",
        adapterName: "Sequelize",
        execute: sequelizeExecutor(config),
        tables: config.tenantModels.map((entry) => ({
          schema: entry.schema,
          table: entry.table,
          qualifiedName: entry.qualifiedName,
          policyName: entry.policyName,
        })),
      });
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
    return config.sequelize.transaction(async (transaction) => {
      await applyPostgresRowContext(
        sequelizeExecutor(config, transaction),
        context,
      );
      return callback(createProtectedClient(config, transaction, context));
    });
  }

  return Object.freeze({
    name: "sequelize" as const,
    strategy: "rowLevel" as const,
    capabilities: SEQUELIZE_ADAPTER_CAPABILITIES,
    config,
    validate,
    run,
    async close() {},
  });
}

function createProtectedClient<TTenant extends TenantRecord>(
  config: SequelizeTenancyConfig<TTenant>,
  transaction: Transaction,
  context: TenantContext<TTenant>,
): ProtectedSequelizeClient {
  return Object.freeze({
    model(model: ModelStatic<Model>) {
      const policy = config.classify(model);
      if (policy === undefined) throw new SequelizeModelUnregisteredError();
      return createProtectedModel(model, policy, transaction, context);
    },
  });
}

function createProtectedModel(
  model: ModelStatic<Model>,
  policy: SequelizeModelPolicy,
  transaction: Transaction,
  context: TenantContext,
): ProtectedSequelizeModel {
  const tenant = policy.kind === "tenant" ? policy.config : undefined;
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
      Object.getPrototypeOf(value) !== null)
  ) {
    throw new SequelizeUnsafeCriteriaError();
  }
}

function sequelizeExecutor(
  config: Pick<SequelizeTenancyConfig, "sequelize">,
  transaction?: Transaction,
): PostgresExecutor {
  return async (sql, bindings) => {
    let index = 0;
    const query = sql.replaceAll("?", () => `$${++index}`);
    const rows = await config.sequelize.query(query, {
      bind: bindings === undefined ? [] : [...bindings],
      type: QueryTypes.SELECT,
      ...(transaction === undefined ? {} : { transaction }),
    });
    return { rows };
  };
}
