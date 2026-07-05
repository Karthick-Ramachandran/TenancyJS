import type { MaybePromise } from "tenancyjs-core";

export type DrizzleDialect = "postgresql" | "mysql";
export type DrizzleTable = object;
export type DrizzleScalar = string | number | boolean | Date | null;
export type DrizzleCriteria = Readonly<Record<string, DrizzleScalar>>;
export type DrizzleValues = Readonly<Record<string, unknown>>;

export interface DrizzleTenantTableConfig {
  readonly table: DrizzleTable;
  readonly tenantProperty?: string;
  readonly tenantColumn?: string;
  readonly policyName?: string;
}

export interface DrizzleCentralTableConfig {
  readonly table: DrizzleTable;
}

export interface ProtectedDrizzleTable {
  findMany(
    where?: DrizzleCriteria,
  ): Promise<readonly Readonly<Record<string, unknown>>[]>;
  findOne(
    where: DrizzleCriteria,
  ): Promise<Readonly<Record<string, unknown>> | null>;
  count(where?: DrizzleCriteria): Promise<number>;
  create(values: DrizzleValues): Promise<void>;
  createMany(values: readonly DrizzleValues[]): Promise<void>;
  update(where: DrizzleCriteria, values: DrizzleValues): Promise<number>;
  delete(where: DrizzleCriteria): Promise<number>;
}

export interface ProtectedDrizzleClient {
  table(table: DrizzleTable): ProtectedDrizzleTable;
  /**
   * The native, tenant-scoped drizzle transaction — full query freedom
   * (relational queries, joins, raw `execute`). Available **only** in a
   * database-enforced scope (database-per-tenant, tenant mode), where the leased
   * binding wraps the tenant's own database. Throws in any facade-enforced scope
   * (ADR-0033). The binding erases the concrete drizzle type, so supply your own
   * (e.g. `client.unrestricted<NodePgDatabase<typeof schema>>()`).
   */
  unrestricted<TDatabase = unknown>(): TDatabase;
}

export interface DrizzleTenancyRunner {
  run<TResult>(
    callback: (client: ProtectedDrizzleClient) => MaybePromise<TResult>,
  ): Promise<TResult>;
}
