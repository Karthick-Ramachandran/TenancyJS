import type { MaybePromise } from "tenancyjs-core";
import type { Model, ModelStatic, Sequelize } from "sequelize";

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

export interface ProtectedSequelizeClient {
  model(model: ModelStatic<Model>): ProtectedSequelizeModel;
  /**
   * The raw, tenant-scoped Sequelize instance — full query freedom (raw SQL,
   * includes, associations). Available **only** in a database-enforced scope
   * (database-per-tenant, tenant mode), where this instance connects solely to
   * the tenant's own leased database. Throws in any facade-enforced scope
   * (ADR-0033).
   */
  unrestricted(): Sequelize;
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
