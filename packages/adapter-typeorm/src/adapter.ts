import type {
  MaybePromise,
  TenancyAdapter,
  TenancyAdapterValidationResult,
  TenantContext,
  TenantRecord,
} from "tenancyjs-core";
import { TenantContextError, unrestrictedRefusedMessage } from "tenancyjs-core";
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
import type {
  DataSource,
  EntityManager,
  EntityTarget,
  FindOptionsWhere,
  ObjectLiteral,
  QueryDeepPartialEntity,
  Repository,
} from "typeorm";

import { typeOrmCapabilities } from "./capabilities.js";
import {
  defineTypeOrmTenancyConfig,
  matchesTypeOrmDialect,
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
  readonly strategy: "rowLevel" | "schemaPerTenant" | "databasePerTenant";
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
  const schemaEngine = createSchemaEngine(config);
  const connectionCache: TenantResourceCache<DataSource> | undefined =
    config.strategy === "databasePerTenant"
      ? createTenantResourceCache<DataSource>({
          capacity: config.maxConnections,
          destroy: async (dataSource) => {
            if (dataSource.isInitialized) await dataSource.destroy();
          },
        })
      : undefined;
  let validated = false;

  async function validate(): Promise<TenancyAdapterValidationResult> {
    if (config.strategy === "databasePerTenant") {
      validated = true;
      return deferredDatabaseValidationResult("TENANCY_TYPEORM", "TypeORM");
    }
    if (config.strategy === "rowLevel" && config.dialect === "mysql") {
      validated = true;
      return adapterEnforcedRowValidationResult(
        "TENANCY_TYPEORM",
        "TypeORM",
        "MySQL",
      );
    }
    try {
      const result =
        config.strategy === "rowLevel"
          ? await validatePostgresRlsPolicies({
              codePrefix: "TENANCY_TYPEORM",
              adapterName: "TypeORM",
              execute: typeOrmExecutor(config.dataSource.manager),
              tables: config.tenantEntities.map((entry) => ({
                schema: entry.schema!,
                table: entry.table,
                qualifiedName: entry.qualifiedName,
                policyName: entry.policyName,
              })),
            })
          : await schemaEngine!.validate(
              typeOrmExecutor(config.dataSource.manager),
            );
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
        "Running a scoped query needs a callback function — pass the function that receives the scoped client.",
      );
    }
    const context = config.manager.getContext();
    if (context === undefined) throw new TenantContextError("missing");
    const runScope = (dataSource: DataSource, databaseEnforced: boolean) => {
      if (!matchesTypeOrmDialect(dataSource.options.type, config.dialect))
        throw new TypeOrmTenancyConfigurationError(
          "TypeORM tenant DataSource dialect does not match the base configuration.",
        );
      return dataSource.transaction(async (manager) => {
        if (config.strategy === "rowLevel" && config.dialect === "postgresql") {
          await applyPostgresRowContext(typeOrmExecutor(manager), context);
        } else if (config.strategy === "schemaPerTenant") {
          await schemaEngine!.applyContext(typeOrmExecutor(manager), context);
        }
        return callback(
          createProtectedClient(
            config,
            manager,
            context,
            config.strategy,
            databaseEnforced,
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
        // Only the leased per-tenant DataSource is database-enforced (ADR-0033).
        (dataSource) => runScope(dataSource, true),
      );
    }
    // ADR-0038: forced-RLS row-level on PostgreSQL in tenant mode is also
    // database-enforced. validate() (guaranteed passed) confirmed forced RLS under
    // a non-BYPASSRLS role, and the tenant GUC is SET LOCAL on this transaction's
    // manager, so raw SQL via the returned EntityManager cannot cross tenants.
    // MySQL row-level (no RLS backstop) and central mode stay facade-enforced.
    const forcedRlsRowLevel =
      config.strategy === "rowLevel" &&
      config.dialect === "postgresql" &&
      context.mode === "tenant";
    return runScope(config.dataSource, forcedRlsRowLevel);
  }

  return Object.freeze({
    name: "typeorm" as const,
    strategy: config.strategy,
    capabilities: typeOrmCapabilities(config.strategy),
    config,
    validate,
    run,
    async close() {
      await connectionCache?.close();
    },
  });
}

function createProtectedClient<TTenant extends TenantRecord>(
  config: TypeOrmTenancyConfig<TTenant>,
  manager: EntityManager,
  context: TenantContext<TTenant>,
  strategy: "rowLevel" | "schemaPerTenant" | "databasePerTenant",
  databaseEnforced: boolean,
): ProtectedTypeOrmClient {
  return Object.freeze({
    unrestricted(): EntityManager {
      // ADR-0033: the raw, tenant-scoped EntityManager — full query freedom
      // (relations, query builder, raw SQL). Available only in a
      // database-enforced scope, where a per-tenant DataSource was leased and
      // the connection is the tenant's own database. Fail closed otherwise.
      if (!databaseEnforced) {
        throw new TypeOrmTenancyConfigurationError(
          unrestrictedRefusedMessage({
            adapter: "typeorm",
            strategy,
            mode: context.mode,
          }),
        );
      }
      return manager;
    },
    repository<TEntity extends ObjectLiteral>(entity: EntityTarget<TEntity>) {
      const policy = config.classify(entity);
      if (policy === undefined) throw new TypeOrmEntityUnregisteredError();
      if (
        strategy !== "rowLevel" &&
        ((context.mode === "tenant" && policy.kind === "central") ||
          (context.mode === "central" && policy.kind === "tenant"))
      ) {
        throw new TypeOrmUnsafeCriteriaError();
      }
      return createProtectedRepository(
        manager.getRepository(entity),
        policy,
        context,
        strategy,
      );
    },
  });
}

function createProtectedRepository<TEntity extends ObjectLiteral>(
  repository: Repository<TEntity>,
  policy: TypeOrmEntityPolicy,
  context: TenantContext,
  strategy: "rowLevel" | "schemaPerTenant" | "databasePerTenant",
): ProtectedTypeOrmRepository<TEntity> {
  const tenant =
    strategy === "rowLevel" && policy.kind === "tenant"
      ? policy.config
      : undefined;
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

function createSchemaEngine<TTenant extends TenantRecord>(
  config: TypeOrmTenancyConfig<TTenant>,
): PostgresSchemaStrategyEngine<TTenant> | undefined {
  if (config.strategy !== "schemaPerTenant") return undefined;
  return createPostgresStrategyEngine({
    codePrefix: "TENANCY_TYPEORM",
    adapterName: "TypeORM",
    resolveSchema: config.schema!,
    centralSchema: config.centralSchema,
    ...(config.role === undefined ? {} : { resolveRole: config.role }),
    tenantTables: config.tenantEntities.map((entry) => entry.table),
    centralTables: [],
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
