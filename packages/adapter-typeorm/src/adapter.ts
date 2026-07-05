import type {
  MaybePromise,
  TenancyAdapter,
  TenancyAdapterValidationResult,
  TenantContext,
  TenantRecord,
} from "tenancyjs-core";
import { TenantContextError } from "tenancyjs-core";
import {
  applyPostgresRowContext,
  decideTenantDiscriminator,
  validatePostgresRlsPolicies,
  type PostgresExecutor,
} from "tenancyjs-adapter-shared";
import type {
  EntityManager,
  EntityTarget,
  FindOptionsWhere,
  ObjectLiteral,
  QueryDeepPartialEntity,
  Repository,
} from "typeorm";

import { TYPEORM_ADAPTER_CAPABILITIES } from "./capabilities.js";
import {
  defineTypeOrmTenancyConfig,
  type NormalizedTypeOrmTenantEntityConfig,
  type TypeOrmEntityPolicy,
  type TypeOrmTenancyConfig,
  type TypeOrmTenancyOptions,
} from "./config.js";
import {
  TypeOrmEntityUnregisteredError,
  TypeOrmPolicyValidationError,
  TypeOrmTenantFieldConflictError,
  TypeOrmTenancyConfigurationError,
  TypeOrmUnsafeCriteriaError,
} from "./errors.js";
import type {
  ProtectedTypeOrmClient,
  ProtectedTypeOrmRepository,
  TypeOrmCriteria,
  TypeOrmValues,
} from "./types.js";

export interface TypeOrmTenancyAdapter<
  TTenant extends TenantRecord = TenantRecord,
> extends TenancyAdapter {
  readonly name: "typeorm";
  readonly strategy: "rowLevel";
  readonly config: TypeOrmTenancyConfig<TTenant>;
  run<TResult>(
    callback: (client: ProtectedTypeOrmClient) => MaybePromise<TResult>,
  ): Promise<TResult>;
  close(): Promise<void>;
}

export function createTypeOrmTenancy<
  TTenant extends TenantRecord = TenantRecord,
>(options: TypeOrmTenancyOptions<TTenant>): TypeOrmTenancyAdapter<TTenant> {
  const config = defineTypeOrmTenancyConfig(options);
  let validated = false;

  async function validate(): Promise<TenancyAdapterValidationResult> {
    try {
      const result = await validatePostgresRlsPolicies({
        codePrefix: "TENANCY_TYPEORM",
        adapterName: "TypeORM",
        execute: typeOrmExecutor(config.dataSource.manager),
        tables: config.tenantEntities.map((entry) => ({
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
            code: "TENANCY_TYPEORM_POLICY_INTROSPECTION_FAILED",
            severity: "error" as const,
            message:
              "TypeORM tenancy could not verify the PostgreSQL RLS contract.",
          }),
        ]),
      });
    }
  }

  async function run<TResult>(
    callback: (client: ProtectedTypeOrmClient) => MaybePromise<TResult>,
  ): Promise<TResult> {
    if (!validated) throw new TypeOrmPolicyValidationError();
    if (typeof callback !== "function") {
      throw new TypeOrmTenancyConfigurationError(
        "TypeORM protected execution requires a callback.",
      );
    }
    const context = config.manager.getContext();
    if (context === undefined) throw new TenantContextError("missing");
    return config.dataSource.transaction(async (manager) => {
      await applyPostgresRowContext(typeOrmExecutor(manager), context);
      return callback(createProtectedClient(config, manager, context));
    });
  }

  return Object.freeze({
    name: "typeorm" as const,
    strategy: "rowLevel" as const,
    capabilities: TYPEORM_ADAPTER_CAPABILITIES,
    config,
    validate,
    run,
    async close() {},
  });
}

function createProtectedClient<TTenant extends TenantRecord>(
  config: TypeOrmTenancyConfig<TTenant>,
  manager: EntityManager,
  context: TenantContext<TTenant>,
): ProtectedTypeOrmClient {
  return Object.freeze({
    repository<TEntity extends ObjectLiteral>(entity: EntityTarget<TEntity>) {
      const policy = config.classify(entity);
      if (policy === undefined) throw new TypeOrmEntityUnregisteredError();
      return createProtectedRepository(
        manager.getRepository(entity),
        policy,
        context,
      );
    },
  });
}

function createProtectedRepository<TEntity extends ObjectLiteral>(
  repository: Repository<TEntity>,
  policy: TypeOrmEntityPolicy,
  context: TenantContext,
): ProtectedTypeOrmRepository<TEntity> {
  const tenant = policy.kind === "tenant" ? policy.config : undefined;
  return Object.freeze({
    async findBy(where: TypeOrmCriteria = {}) {
      const rows = await repository.findBy(
        scopedWhere(where, tenant, context) as FindOptionsWhere<TEntity>,
      );
      return Object.freeze(rows.map(toPlain));
    },
    async findOneBy(where: TypeOrmCriteria) {
      const row = await repository.findOneBy(
        scopedWhere(where, tenant, context) as FindOptionsWhere<TEntity>,
      );
      return row === null ? null : toPlain(row);
    },
    countBy(where: TypeOrmCriteria = {}) {
      return repository.countBy(
        scopedWhere(where, tenant, context) as FindOptionsWhere<TEntity>,
      );
    },
    async create(values: TypeOrmValues) {
      await repository.insert(
        scopedValues(
          values,
          tenant,
          context,
          "create",
        ) as QueryDeepPartialEntity<TEntity>,
      );
    },
    async createMany(values: readonly TypeOrmValues[]) {
      if (!Array.isArray(values) || values.length === 0)
        throw new TypeOrmUnsafeCriteriaError();
      await repository.insert(
        values.map((value) =>
          scopedValues(value, tenant, context, "create"),
        ) as QueryDeepPartialEntity<TEntity>[],
      );
    },
    async update(where: TypeOrmCriteria, values: TypeOrmValues) {
      const result = await repository.update(
        scopedWhere(where, tenant, context) as FindOptionsWhere<TEntity>,
        scopedValues(
          values,
          tenant,
          context,
          "update",
        ) as QueryDeepPartialEntity<TEntity>,
      );
      return result.affected ?? 0;
    },
    async delete(where: TypeOrmCriteria) {
      const result = await repository.delete(
        scopedWhere(where, tenant, context) as FindOptionsWhere<TEntity>,
      );
      return result.affected ?? 0;
    },
  });
}

function scopedWhere(
  where: TypeOrmCriteria,
  policy: NormalizedTypeOrmTenantEntityConfig | undefined,
  context: TenantContext,
): Record<string, unknown> {
  assertPlainScalars(where);
  const result: Record<string, unknown> = { ...where };
  if (policy !== undefined && context.mode === "tenant") {
    if (
      Object.hasOwn(result, policy.tenantProperty) &&
      result[policy.tenantProperty] !== context.tenant.id
    ) {
      throw new TypeOrmTenantFieldConflictError("filter");
    }
    result[policy.tenantProperty] = context.tenant.id;
  }
  return result;
}

function scopedValues(
  values: TypeOrmValues,
  policy: NormalizedTypeOrmTenantEntityConfig | undefined,
  context: TenantContext,
  operation: "create" | "update",
): Record<string, unknown> {
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
    throw new TypeOrmTenantFieldConflictError(operation);
  if (decision.kind === "inject")
    result[policy.tenantProperty] = decision.value;
  return result;
}

function assertPlainScalars(value: unknown): asserts value is TypeOrmCriteria {
  assertPlainRecord(value);
  for (const entry of Object.values(value)) {
    if (
      entry !== null &&
      typeof entry !== "string" &&
      typeof entry !== "number" &&
      typeof entry !== "boolean" &&
      !(entry instanceof Date)
    ) {
      throw new TypeOrmUnsafeCriteriaError();
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
    throw new TypeOrmUnsafeCriteriaError();
  }
}

function toPlain<TEntity extends ObjectLiteral>(
  row: TEntity,
): Readonly<Partial<TEntity>> {
  return Object.freeze({ ...row });
}

function typeOrmExecutor(
  manager: Pick<EntityManager, "query">,
): PostgresExecutor {
  return async (sql, bindings) => {
    // Replace placeholders deterministically without inspecting or interpolating values.
    let index = 0;
    const query = sql.replaceAll("?", () => `$${++index}`);
    const rows = await manager.query(
      query,
      bindings === undefined ? [] : [...bindings],
    );
    return { rows };
  };
}
