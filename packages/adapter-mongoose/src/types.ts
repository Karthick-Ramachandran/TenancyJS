import type { MaybePromise } from "tenancyjs-core";
import type { Connection, Model, Types } from "mongoose";

export type MongooseScalar =
  string | number | boolean | Date | Types.ObjectId | null;
export type MongooseFilter = Readonly<Record<string, MongooseScalar>>;
export type MongooseValues = Readonly<Record<string, unknown>>;

export interface MongooseTenantModelConfig {
  readonly model: Model<unknown>;
  readonly tenantField?: string;
}

export interface MongooseCentralModelConfig {
  readonly model: Model<unknown>;
}

export interface ProtectedMongooseModel {
  find(
    filter?: MongooseFilter,
  ): Promise<readonly Readonly<Record<string, unknown>>[]>;
  findOne(
    filter: MongooseFilter,
  ): Promise<Readonly<Record<string, unknown>> | null>;
  count(filter?: MongooseFilter): Promise<number>;
  create(values: MongooseValues): Promise<void>;
  createMany(values: readonly MongooseValues[]): Promise<void>;
  update(filter: MongooseFilter, values: MongooseValues): Promise<number>;
  delete(filter: MongooseFilter): Promise<number>;
}

export interface ProtectedMongooseClient {
  model(model: Model<unknown>): ProtectedMongooseModel;
}

export interface MongooseTenancyRunner {
  run<TResult>(
    callback: (client: ProtectedMongooseClient) => MaybePromise<TResult>,
  ): Promise<TResult>;
}

export interface MongooseDatabasePlacement {
  readonly key: string;
  readonly create: () => MaybePromise<Connection>;
}
