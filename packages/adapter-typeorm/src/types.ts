import type { MaybePromise, TenantRecord } from "@tenancyjs/core";
import type { EntityTarget, ObjectLiteral } from "typeorm";

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

export type TypeOrmTenantRecord = TenantRecord;
