import type { MaybePromise, TenantRecord } from "tenancyjs-core";
import type {
  DataSource,
  EntityManager,
  EntityTarget,
  ObjectLiteral,
} from "typeorm";

export type TypeOrmScalar = string | number | boolean | Date | null;
export type TypeOrmCriteria = Readonly<Record<string, TypeOrmScalar>>;
export type TypeOrmValues = Readonly<Record<string, unknown>>;

export interface TypeOrmTenantEntityConfig<
  TEntity extends ObjectLiteral = ObjectLiteral,
> {
  readonly entity: EntityTarget<TEntity>;
  readonly table: string;
  readonly tenantProperty?: string;
  readonly tenantColumn?: string;
  readonly policyName?: string;
}

export interface TypeOrmCentralEntityConfig<
  TEntity extends ObjectLiteral = ObjectLiteral,
> {
  readonly entity: EntityTarget<TEntity>;
}

export interface ProtectedTypeOrmRepository<
  TEntity extends ObjectLiteral = ObjectLiteral,
> {
  findBy(
    where?: TypeOrmCriteria,
  ): Promise<readonly Readonly<Partial<TEntity>>[]>;
  findOneBy(where: TypeOrmCriteria): Promise<Readonly<Partial<TEntity>> | null>;
  countBy(where?: TypeOrmCriteria): Promise<number>;
  create(values: TypeOrmValues): Promise<void>;
  createMany(values: readonly TypeOrmValues[]): Promise<void>;
  update(where: TypeOrmCriteria, values: TypeOrmValues): Promise<number>;
  delete(where: TypeOrmCriteria): Promise<number>;
}

export interface ProtectedTypeOrmClient {
  repository<TEntity extends ObjectLiteral>(
    entity: EntityTarget<TEntity>,
  ): ProtectedTypeOrmRepository<TEntity>;
  /**
   * The raw, tenant-scoped TypeORM `EntityManager` — full query freedom
   * (relations, query builder, raw SQL). Available **only** in a
   * database-enforced scope (database-per-tenant, tenant mode), where the leased
   * DataSource *is* the tenant's own database. Throws in any facade-enforced
   * scope (ADR-0033).
   */
  unrestricted(): EntityManager;
}

export interface TypeOrmTenancyRunner {
  run<TResult>(
    callback: (client: ProtectedTypeOrmClient) => MaybePromise<TResult>,
  ): Promise<TResult>;
}

export interface TypeOrmTenantPlacement<TResource extends object> {
  readonly key: string;
  readonly create: () => MaybePromise<TResource>;
}

export type TypeOrmDatabasePlacement = TypeOrmTenantPlacement<DataSource>;

export type TypeOrmTenantRecord = TenantRecord;
