import { and, eq, getTableColumns, sql, type SQL } from "drizzle-orm";
import { getTableConfig as getMySqlTableConfig } from "drizzle-orm/mysql-core";
import { getTableConfig as getPgTableConfig } from "drizzle-orm/pg-core";
import type { MaybePromise } from "tenancyjs-core";
import type { PostgresExecutor } from "tenancyjs-adapter-shared";

import { DrizzleTenancyConfigurationError } from "./errors.js";
import type {
  DrizzleCriteria,
  DrizzleDialect,
  DrizzleTable,
  DrizzleValues,
} from "./types.js";

const BINDING = Symbol("tenancyjs.drizzle.binding");

export interface DrizzleTableMetadata {
  readonly name: string;
  readonly schema: string | undefined;
  readonly columns: Readonly<Record<string, Readonly<{ name: string }>>>;
}

export interface DrizzleSessionBinding {
  readonly postgresExecutor: PostgresExecutor | undefined;
  /**
   * The native drizzle transaction this session wraps. Exposed only so a
   * database-enforced scope can hand it back via `client.unrestricted()`; the
   * protected client gates access — it is never returned in a facade-enforced
   * scope.
   */
  readonly native: unknown;
  findMany(
    table: DrizzleTable,
    where: DrizzleCriteria,
  ): Promise<readonly Readonly<Record<string, unknown>>[]>;
  count(table: DrizzleTable, where: DrizzleCriteria): Promise<number>;
  create(table: DrizzleTable, values: readonly DrizzleValues[]): Promise<void>;
  update(
    table: DrizzleTable,
    where: DrizzleCriteria,
    values: DrizzleValues,
  ): Promise<number>;
  delete(table: DrizzleTable, where: DrizzleCriteria): Promise<number>;
}

export interface DrizzleDatabaseBinding {
  readonly dialect: DrizzleDialect;
  readonly ownsLifecycle: boolean;
  readonly [BINDING]: true;
  close(): Promise<void>;
  metadata(table: DrizzleTable): DrizzleTableMetadata;
  postgresExecutor: PostgresExecutor | undefined;
  transaction<TResult>(
    callback: (session: DrizzleSessionBinding) => MaybePromise<TResult>,
  ): Promise<TResult>;
}

interface DrizzleExecutable {
  execute(query: SQL): Promise<unknown>;
  transaction<TResult>(
    callback: (transaction: DrizzleExecutable) => Promise<TResult>,
  ): Promise<TResult>;
  select(fields?: Record<string, unknown>): {
    from(table: object): { where(condition: unknown): Promise<unknown> };
  };
  insert(table: object): { values(values: unknown): Promise<unknown> };
  update(table: object): {
    set(values: unknown): { where(condition: unknown): Promise<unknown> };
  };
  delete(table: object): { where(condition: unknown): Promise<unknown> };
}

export function createPostgresDrizzleBinding<TDatabase extends object>(
  database: TDatabase,
  options: DrizzleBindingOptions = {},
): DrizzleDatabaseBinding {
  return createBinding("postgresql", database, options);
}

export function createMySqlDrizzleBinding<TDatabase extends object>(
  database: TDatabase,
  options: DrizzleBindingOptions = {},
): DrizzleDatabaseBinding {
  return createBinding("mysql", database, options);
}

export interface DrizzleBindingOptions {
  readonly close?: () => MaybePromise<void>;
}

function createBinding(
  dialect: DrizzleDialect,
  value: object,
  options: DrizzleBindingOptions,
): DrizzleDatabaseBinding {
  const database = value as unknown as DrizzleExecutable;
  if (
    typeof database.transaction !== "function" ||
    typeof database.select !== "function"
  )
    throw new DrizzleTenancyConfigurationError(
      "Drizzle tenancy requires a compatible database instance.",
    );
  const metadata = (table: DrizzleTable): DrizzleTableMetadata => {
    try {
      const config =
        dialect === "postgresql"
          ? getPgTableConfig(table as never)
          : getMySqlTableConfig(table as never);
      const columns = getTableColumns(table as never) as Record<
        string,
        { name: string }
      >;
      return Object.freeze({
        name: config.name,
        schema: config.schema,
        columns: Object.freeze({ ...columns }),
      });
    } catch {
      throw new DrizzleTenancyConfigurationError(
        `Drizzle tenancy requires a ${dialect} table from the matching dialect.`,
      );
    }
  };
  return Object.freeze({
    dialect,
    ownsLifecycle: options.close !== undefined,
    [BINDING]: true as const,
    async close() {
      await options.close?.();
    },
    metadata,
    postgresExecutor: dialect === "postgresql" ? executor(database) : undefined,
    transaction: <TResult>(
      callback: (session: DrizzleSessionBinding) => MaybePromise<TResult>,
    ) =>
      database.transaction(async (transaction) =>
        callback(createSession(transaction, dialect)),
      ),
  });
}

function createSession(
  database: DrizzleExecutable,
  dialect: DrizzleDialect,
): DrizzleSessionBinding {
  return Object.freeze({
    postgresExecutor: dialect === "postgresql" ? executor(database) : undefined,
    native: database,
    async findMany(table: DrizzleTable, where: DrizzleCriteria) {
      const rows = await database
        .select()
        .from(table)
        .where(condition(table, where));
      if (!Array.isArray(rows))
        throw new DrizzleTenancyConfigurationError(
          "Drizzle select returned an unsupported result.",
        );
      return Object.freeze(
        rows.map((row) =>
          Object.freeze({ ...(row as Record<string, unknown>) }),
        ),
      );
    },
    async count(table: DrizzleTable, where: DrizzleCriteria) {
      const rows = await database
        .select({ value: sql<number>`count(*)` })
        .from(table)
        .where(condition(table, where));
      if (!Array.isArray(rows) || rows.length !== 1)
        throw new DrizzleTenancyConfigurationError(
          "Drizzle count returned an unsupported result.",
        );
      return Number((rows[0] as { value: unknown }).value);
    },
    async create(table: DrizzleTable, values: readonly DrizzleValues[]) {
      await database
        .insert(table)
        .values(values.length === 1 ? values[0] : values);
    },
    async update(
      table: DrizzleTable,
      where: DrizzleCriteria,
      values: DrizzleValues,
    ) {
      return affected(
        await database.update(table).set(values).where(condition(table, where)),
      );
    },
    async delete(table: DrizzleTable, where: DrizzleCriteria) {
      return affected(
        await database.delete(table).where(condition(table, where)),
      );
    },
  });
}

function condition(
  table: DrizzleTable,
  where: DrizzleCriteria,
): SQL | undefined {
  const columns = getTableColumns(table as never) as Record<string, unknown>;
  const expressions = Object.entries(where).map(([property, value]) => {
    const column = columns[property];
    if (column === undefined)
      throw new DrizzleTenancyConfigurationError(
        "Drizzle criteria reference an unknown column property.",
      );
    return eq(column as never, value);
  });
  return expressions.length === 0 ? undefined : and(...expressions);
}

function executor(database: DrizzleExecutable): PostgresExecutor {
  return async (text, bindings = []) => {
    const parts = text.split("?");
    if (parts.length !== bindings.length + 1)
      throw new DrizzleTenancyConfigurationError(
        "Drizzle PostgreSQL executor received invalid bindings.",
      );
    const query = sql.empty();
    for (const [index, part] of parts.entries()) {
      query.append(sql.raw(part));
      if (index < bindings.length)
        query.append(sql`${sql.param(bindings[index])}`);
    }
    const result = await database.execute(query);
    const rows =
      isRecord(result) && Array.isArray(result.rows) ? result.rows : [];
    return { rows };
  };
}

function affected(result: unknown): number {
  if (isRecord(result) && typeof result.rowCount === "number")
    return result.rowCount;
  if (
    Array.isArray(result) &&
    isRecord(result[0]) &&
    typeof result[0].affectedRows === "number"
  )
    return result[0].affectedRows;
  if (isRecord(result) && typeof result.affectedRows === "number")
    return result.affectedRows;
  return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}
