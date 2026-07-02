import type { MaybePromise } from "@tenancyjs/core";

export type KnexSafeScalar = string | number | boolean | Date | null;
export type KnexDataRecord = Readonly<Record<string, KnexSafeScalar>>;

export interface ProtectedKnexQuery<
  TResult = readonly Record<string, unknown>[],
> extends PromiseLike<TResult> {
  where(column: string, value: KnexSafeScalar): ProtectedKnexQuery<TResult>;
  where(values: KnexDataRecord): ProtectedKnexQuery<TResult>;
  whereIn(
    column: string,
    values: readonly KnexSafeScalar[],
  ): ProtectedKnexQuery<TResult>;
  select(
    ...columns: readonly string[]
  ): ProtectedKnexQuery<readonly Record<string, unknown>[]>;
  first(
    ...columns: readonly string[]
  ): ProtectedKnexQuery<Record<string, unknown> | undefined>;
  count(
    column?: string,
  ): ProtectedKnexQuery<readonly Record<string, string | number>[]>;
  min(column: string): ProtectedKnexQuery<readonly Record<string, unknown>[]>;
  max(column: string): ProtectedKnexQuery<readonly Record<string, unknown>[]>;
  sum(column: string): ProtectedKnexQuery<readonly Record<string, unknown>[]>;
  avg(column: string): ProtectedKnexQuery<readonly Record<string, unknown>[]>;
  insert(
    data: KnexDataRecord | readonly KnexDataRecord[],
  ): ProtectedKnexQuery<unknown>;
  update(data: KnexDataRecord): ProtectedKnexQuery<number>;
  delete(): ProtectedKnexQuery<number>;
  returning(
    ...columns: readonly string[]
  ): ProtectedKnexQuery<readonly Record<string, unknown>[]>;
  orderBy(
    column: string,
    direction?: "asc" | "desc",
  ): ProtectedKnexQuery<TResult>;
  limit(value: number): ProtectedKnexQuery<TResult>;
  offset(value: number): ProtectedKnexQuery<TResult>;
}

export interface ProtectedKnexClient {
  table<TResult = readonly Record<string, unknown>[]>(
    name: string,
  ): ProtectedKnexQuery<TResult>;
  transaction<TResult>(
    callback: (client: ProtectedKnexClient) => MaybePromise<TResult>,
  ): Promise<TResult>;
}
