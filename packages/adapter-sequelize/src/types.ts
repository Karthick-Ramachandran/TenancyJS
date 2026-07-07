import type { MaybePromise } from "tenancyjs-core";
import type { Model, ModelStatic, Sequelize, Transaction } from "sequelize";

export type SequelizeScalar = string | number | boolean | Date | null;
export type SequelizeCriteria = Readonly<Record<string, SequelizeScalar>>;
export type SequelizeValues = Readonly<Record<string, unknown>>;

export interface SequelizeTenantModelConfig<TModel extends Model = Model> {
  readonly model: ModelStatic<TModel>;
  readonly table: string;
  readonly tenantAttribute?: string;
  readonly tenantColumn?: string;
  readonly policyName?: string;
}

export interface SequelizeCentralModelConfig<TModel extends Model = Model> {
  readonly model: ModelStatic<TModel>;
}

export interface ProtectedSequelizeModel {
  findAll(
    where?: SequelizeCriteria,
  ): Promise<readonly Readonly<Record<string, unknown>>[]>;
  findOne(
    where: SequelizeCriteria,
  ): Promise<Readonly<Record<string, unknown>> | null>;
  count(where?: SequelizeCriteria): Promise<number>;
  create(values: SequelizeValues): Promise<void>;
  createMany(values: readonly SequelizeValues[]): Promise<void>;
  update(where: SequelizeCriteria, values: SequelizeValues): Promise<number>;
  delete(where: SequelizeCriteria): Promise<number>;
}

/**
 * The raw, tenant-scoped Sequelize handle for a database-enforced scope. Run
 * raw SQL as `sequelize.query(sql, { transaction })` — the `transaction` carries
 * the tenant context (a leased per-tenant connection for database-per-tenant, or
 * the `SET LOCAL` tenant GUC for forced-RLS row-level), so every statement stays
 * bound to the current tenant. Running on `sequelize` without the `transaction`
 * is unscoped and must be avoided.
 */
export interface SequelizeUnrestricted {
  readonly sequelize: Sequelize;
  readonly transaction: Transaction;
}

export interface ProtectedSequelizeClient {
  model(model: ModelStatic<Model>): ProtectedSequelizeModel;
  /**
   * Full query freedom (raw SQL, includes, associations), scoped to the current
   * tenant. Available **only** in a database-enforced scope: database-per-tenant
   * (the transaction runs on the tenant's own leased database) or forced-RLS
   * row-level on PostgreSQL (the transaction holds the `SET LOCAL` tenant GUC and
   * the validated policy binds every statement). Throws in any facade-enforced
   * scope, in central mode, and on MySQL row-level (no RLS backstop) - ADR-0033,
   * ADR-0038.
   */
  unrestricted(): SequelizeUnrestricted;
}

export interface SequelizeTenancyRunner {
  run<TResult>(
    callback: (client: ProtectedSequelizeClient) => MaybePromise<TResult>,
  ): Promise<TResult>;
}

export interface SequelizeDatabasePlacement {
  readonly key: string;
  readonly create: () => MaybePromise<Sequelize>;
}
