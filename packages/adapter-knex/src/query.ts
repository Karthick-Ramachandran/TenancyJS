import { unrestrictedRefusedMessage, type TenantContext } from "tenancyjs-core";
import { decideTenantDiscriminator } from "tenancyjs-adapter-shared";
import type { Knex } from "knex";

import type { KnexTablePolicy } from "./config.js";
import {
  KnexTenantFieldConflictError,
  KnexTenancyConfigurationError,
  KnexUnsupportedOperationError,
} from "./errors.js";
import type {
  KnexDataRecord,
  KnexSafeScalar,
  ProtectedKnexClient,
  ProtectedKnexQuery,
} from "./types.js";

const COLUMN = /^(?:[A-Za-z_][A-Za-z0-9_]*\.)?[A-Za-z_][A-Za-z0-9_]*$|^\*$/;

type Operation =
  | Readonly<{ kind: "select"; columns: readonly string[] }>
  | Readonly<{ kind: "first"; columns: readonly string[] }>
  | Readonly<{ kind: "count"; column: string }>
  | Readonly<{
      kind: "aggregate";
      method: "min" | "max" | "sum" | "avg";
      column: string;
    }>
  | Readonly<{ kind: "insert"; data: readonly KnexDataRecord[] }>
  | Readonly<{ kind: "update"; data: KnexDataRecord }>
  | Readonly<{ kind: "delete" }>;

interface QueryState {
  readonly transaction: Knex.Transaction;
  readonly context: TenantContext;
  readonly strategy: "rowLevel" | "schemaPerTenant" | "databasePerTenant";
  readonly policy: KnexTablePolicy;
  readonly where: readonly Readonly<{
    column: string;
    values: readonly KnexSafeScalar[];
    in: boolean;
  }>[];
  readonly operation: Operation;
  readonly returning: readonly string[];
  readonly order: readonly Readonly<{
    column: string;
    direction: "asc" | "desc";
  }>[];
  readonly limit?: number;
  readonly offset?: number;
}

export function createProtectedKnexClient(
  transaction: Knex.Transaction,
  context: TenantContext,
  classify: (name: string) => KnexTablePolicy,
  createSavepoint: <TResult>(
    transaction: Knex.Transaction,
    callback: (transaction: Knex.Transaction) => Promise<TResult>,
  ) => Promise<TResult>,
  strategy: "rowLevel" | "schemaPerTenant" | "databasePerTenant",
  databaseEnforced: boolean,
): ProtectedKnexClient {
  const client: ProtectedKnexClient = {
    table(name) {
      const policy = classify(name);
      return protectQuery(
        new KnexQuery({
          transaction,
          context,
          strategy,
          policy,
          where: Object.freeze([]),
          operation: Object.freeze({
            kind: "select",
            columns: Object.freeze(["*"]),
          }),
          returning: Object.freeze([]),
          order: Object.freeze([]),
        }),
      );
    },
    transaction(callback) {
      if (typeof callback !== "function") {
        throw new KnexTenancyConfigurationError(
          "Protected Knex transaction requires a callback.",
        );
      }
      return createSavepoint(transaction, async (savepoint) =>
        callback(
          createProtectedKnexClient(
            savepoint,
            context,
            classify,
            createSavepoint,
            strategy,
            databaseEnforced,
          ),
        ),
      );
    },
    unrestricted() {
      // ADR-0033: full query freedom is safe only where the database/connection
      // physically enforces isolation. `databaseEnforced` is set true by run()
      // ONLY on the path that leased a separate per-tenant connection — never
      // from the strategy string, which is not a proxy for real isolation (a
      // database-per-tenant config in central mode still runs on the shared
      // admin connection). Fail closed everywhere the boundary isn't proven.
      if (!databaseEnforced) {
        throw new KnexTenancyConfigurationError(
          unrestrictedRefusedMessage({
            adapter: "knex",
            strategy,
            mode: context.mode,
          }),
        );
      }
      return transaction;
    },
  };
  return protectSurface(client, "client") as ProtectedKnexClient;
}

class KnexQuery<TResult> implements ProtectedKnexQuery<TResult> {
  readonly #state: QueryState;
  #execution: Promise<unknown> | undefined;

  constructor(state: QueryState) {
    this.#state = Object.freeze(state);
  }

  where(
    columnOrValues: string | KnexDataRecord,
    value?: KnexSafeScalar,
  ): ProtectedKnexQuery<TResult> {
    const clauses =
      typeof columnOrValues === "string"
        ? [whereClause(columnOrValues, [assertScalar(value)], false)]
        : Object.entries(assertRecord(columnOrValues, "where")).map(
            ([column, scalar]) => whereClause(column, [scalar], false),
          );
    return this.#next({
      where: Object.freeze([...this.#state.where, ...clauses]),
    });
  }

  whereIn(
    column: string,
    values: readonly KnexSafeScalar[],
  ): ProtectedKnexQuery<TResult> {
    if (!Array.isArray(values) || values.length === 0) {
      throw new KnexTenancyConfigurationError(
        "Protected Knex whereIn requires at least one scalar value.",
      );
    }
    return this.#next({
      where: Object.freeze([
        ...this.#state.where,
        whereClause(column, Object.freeze(values.map(assertScalar)), true),
      ]),
    });
  }

  select(
    ...columns: readonly string[]
  ): ProtectedKnexQuery<readonly Record<string, unknown>[]> {
    return this.#next({ operation: selectOperation("select", columns) });
  }

  first(
    ...columns: readonly string[]
  ): ProtectedKnexQuery<Record<string, unknown> | undefined> {
    return this.#next({ operation: selectOperation("first", columns) });
  }

  count(
    column = "*",
  ): ProtectedKnexQuery<readonly Record<string, string | number>[]> {
    return this.#next({
      operation: Object.freeze({ kind: "count", column: assertColumn(column) }),
    });
  }

  min(column: string): ProtectedKnexQuery<readonly Record<string, unknown>[]> {
    return this.#aggregate("min", column);
  }

  max(column: string): ProtectedKnexQuery<readonly Record<string, unknown>[]> {
    return this.#aggregate("max", column);
  }

  sum(column: string): ProtectedKnexQuery<readonly Record<string, unknown>[]> {
    return this.#aggregate("sum", column);
  }

  avg(column: string): ProtectedKnexQuery<readonly Record<string, unknown>[]> {
    return this.#aggregate("avg", column);
  }

  insert(
    data: KnexDataRecord | readonly KnexDataRecord[],
  ): ProtectedKnexQuery<unknown> {
    const rows = (Array.isArray(data) ? data : [data]).map((row) =>
      assertRecord(row, "insert"),
    );
    if (rows.length === 0) {
      throw new KnexTenancyConfigurationError(
        "Protected Knex insert requires at least one row.",
      );
    }
    return this.#next({
      operation: Object.freeze({ kind: "insert", data: Object.freeze(rows) }),
    });
  }

  update(data: KnexDataRecord): ProtectedKnexQuery<number> {
    return this.#next({
      operation: Object.freeze({
        kind: "update",
        data: assertRecord(data, "update"),
      }),
    });
  }

  delete(): ProtectedKnexQuery<number> {
    return this.#next({ operation: Object.freeze({ kind: "delete" }) });
  }

  returning(
    ...columns: readonly string[]
  ): ProtectedKnexQuery<readonly Record<string, unknown>[]> {
    if (columns.length === 0) {
      throw new KnexTenancyConfigurationError(
        "Protected Knex returning requires at least one column.",
      );
    }
    return this.#next({ returning: Object.freeze(columns.map(assertColumn)) });
  }

  orderBy(
    column: string,
    direction: "asc" | "desc" = "asc",
  ): ProtectedKnexQuery<TResult> {
    if (direction !== "asc" && direction !== "desc") {
      throw new KnexTenancyConfigurationError(
        "Protected Knex order direction must be asc or desc.",
      );
    }
    return this.#next({
      order: Object.freeze([
        ...this.#state.order,
        Object.freeze({ column: assertColumn(column), direction }),
      ]),
    });
  }

  limit(value: number): ProtectedKnexQuery<TResult> {
    return this.#next({ limit: assertNonNegativeInteger(value, "limit") });
  }

  offset(value: number): ProtectedKnexQuery<TResult> {
    return this.#next({ offset: assertNonNegativeInteger(value, "offset") });
  }

  then<TFulfilled = TResult, TRejected = never>(
    onfulfilled?:
      ((value: TResult) => TFulfilled | PromiseLike<TFulfilled>) | null,
    onrejected?:
      ((reason: unknown) => TRejected | PromiseLike<TRejected>) | null,
  ): PromiseLike<TFulfilled | TRejected> {
    this.#execution ??= this.#execute();
    return (this.#execution as Promise<TResult>).then(onfulfilled, onrejected);
  }

  #aggregate(method: "min" | "max" | "sum" | "avg", column: string) {
    return this.#next({
      operation: Object.freeze({
        kind: "aggregate",
        method,
        column: assertColumn(column),
      }),
    }) as ProtectedKnexQuery<readonly Record<string, unknown>[]>;
  }

  #next<TNext = TResult>(
    change: Partial<QueryState>,
  ): ProtectedKnexQuery<TNext> {
    return protectQuery(new KnexQuery<TNext>({ ...this.#state, ...change }));
  }

  async #execute(): Promise<unknown> {
    const { policy, context, operation } = this.#state;
    if (
      this.#state.strategy !== "rowLevel" &&
      ((context.mode === "tenant" && policy.kind === "central") ||
        (context.mode === "central" && policy.kind === "tenant"))
    ) {
      throw new KnexUnsupportedOperationError(
        "cross-placement table access",
        policy.qualifiedName,
      );
    }
    let builder = this.#state.transaction(policy.qualifiedName);
    if (
      this.#state.strategy === "rowLevel" &&
      policy.kind === "tenant" &&
      context.mode === "tenant"
    ) {
      builder = builder.where(policy.tenantColumn, context.tenant.id);
    }
    for (const clause of this.#state.where) {
      builder = clause.in
        ? builder.whereIn(clause.column, [...clause.values])
        : builder.where(clause.column, clause.values[0]!);
    }
    for (const order of this.#state.order)
      builder = builder.orderBy(order.column, order.direction);
    if (this.#state.limit !== undefined)
      builder = builder.limit(this.#state.limit);
    if (this.#state.offset !== undefined)
      builder = builder.offset(this.#state.offset);

    switch (operation.kind) {
      case "select":
        assertNoReturning(this.#state);
        return builder.select(...operation.columns);
      case "first":
        assertNoReturning(this.#state);
        return builder.first(...operation.columns);
      case "count":
        assertNoReturning(this.#state);
        return builder.count(operation.column);
      case "aggregate":
        assertNoReturning(this.#state);
        return builder[operation.method](operation.column);
      case "insert": {
        const rows = operation.data.map((row) =>
          scopeInsert(policy, context, row, this.#state.strategy),
        );
        let query = builder.insert(rows.length === 1 ? rows[0] : rows);
        if (this.#state.returning.length > 0)
          query = query.returning(this.#state.returning);
        return query;
      }
      case "update": {
        const data = scopeUpdate(
          policy,
          context,
          operation.data,
          this.#state.strategy,
        );
        let query = builder.update(data);
        if (this.#state.returning.length > 0)
          query = query.returning(this.#state.returning);
        return query;
      }
      case "delete": {
        let query = builder.delete();
        if (this.#state.returning.length > 0)
          query = query.returning(this.#state.returning);
        return query;
      }
    }
  }
}

function scopeInsert(
  policy: KnexTablePolicy,
  context: TenantContext,
  data: KnexDataRecord,
  strategy: "rowLevel" | "schemaPerTenant" | "databasePerTenant",
): KnexDataRecord {
  if (
    strategy !== "rowLevel" ||
    policy.kind !== "tenant" ||
    context.mode !== "tenant"
  )
    return data;
  const supplied = data[policy.tenantColumn];
  const decision = decideTenantDiscriminator(
    context.tenant.id,
    "create",
    supplied !== undefined,
    supplied,
  );
  if (decision.kind === "reject") {
    throw new KnexTenantFieldConflictError(policy.qualifiedName, "insert");
  }
  return decision.kind === "inject"
    ? Object.freeze({ ...data, [policy.tenantColumn]: decision.value })
    : data;
}

function scopeUpdate(
  policy: KnexTablePolicy,
  context: TenantContext,
  data: KnexDataRecord,
  strategy: "rowLevel" | "schemaPerTenant" | "databasePerTenant",
): KnexDataRecord {
  if (
    strategy === "rowLevel" &&
    policy.kind === "tenant" &&
    decideTenantDiscriminator(
      context.mode === "tenant" ? context.tenant.id : undefined,
      "update",
      Object.hasOwn(data, policy.tenantColumn),
      data[policy.tenantColumn],
    ).kind === "reject"
  ) {
    throw new KnexTenantFieldConflictError(policy.qualifiedName, "update");
  }
  return data;
}

function assertNoReturning(state: QueryState): void {
  if (state.returning.length > 0) {
    throw new KnexUnsupportedOperationError(
      "returning",
      state.policy.qualifiedName,
    );
  }
}

function selectOperation(
  kind: "select" | "first",
  columns: readonly string[],
): Operation {
  return Object.freeze({
    kind,
    columns: Object.freeze(
      (columns.length === 0 ? ["*"] : columns).map(assertColumn),
    ),
  });
}

function whereClause(
  column: string,
  values: readonly KnexSafeScalar[],
  in_: boolean,
) {
  return Object.freeze({
    column: assertColumn(column),
    values: Object.freeze(values),
    in: in_,
  });
}

function assertRecord(value: unknown, operation: string): KnexDataRecord {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new KnexTenancyConfigurationError(
      `Protected Knex ${operation} data must be a plain scalar record.`,
    );
  }
  const result: Record<string, KnexSafeScalar> = {};
  for (const [column, scalar] of Object.entries(value))
    result[assertColumn(column)] = assertScalar(scalar);
  if (Object.keys(result).length === 0) {
    throw new KnexTenancyConfigurationError(
      `Protected Knex ${operation} data cannot be empty.`,
    );
  }
  return Object.freeze(result);
}

function assertScalar(value: unknown): KnexSafeScalar {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value instanceof Date
  ) {
    return value;
  }
  throw new KnexTenancyConfigurationError(
    "Protected Knex values must be scalar and cannot contain raw SQL or builders.",
  );
}

function assertColumn(value: string): string {
  if (typeof value !== "string" || !COLUMN.test(value)) {
    throw new KnexTenancyConfigurationError(
      "Protected Knex columns must be unaliased identifiers.",
    );
  }
  return value;
}

function assertNonNegativeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new KnexTenancyConfigurationError(
      `Protected Knex ${name} must be a non-negative integer.`,
    );
  }
  return value;
}

function protectQuery<TResult>(
  query: KnexQuery<TResult>,
): ProtectedKnexQuery<TResult> {
  return protectSurface(
    query,
    "protected-query",
  ) as ProtectedKnexQuery<TResult>;
}

function protectSurface<T extends object>(target: T, label: string): T {
  return new Proxy(target, {
    get(object, property) {
      if (typeof property === "symbol")
        return Reflect.get(object, property, object);
      if (!(property in object))
        throw new KnexUnsupportedOperationError(
          property,
          label === "client" ? undefined : label,
        );
      const value: unknown = Reflect.get(object, property, object);
      return typeof value === "function" ? value.bind(object) : value;
    },
  });
}
