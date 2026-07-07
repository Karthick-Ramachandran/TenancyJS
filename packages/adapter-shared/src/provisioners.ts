import type {
  MaybePromise,
  TenancyProvisioner,
  TenantRecord,
} from "tenancyjs-core";

import { assertSqlIdentifier } from "./identifiers.js";

/**
 * A privileged PostgreSQL connection used ONLY for DDL (create/drop schema or
 * database). This is exactly the shape of `pg`'s `Pool`/`Client`, so a host
 * passes its existing admin connection with no wrapping. It must be a different,
 * higher-privileged connection than the fail-closed runtime role — provisioning
 * runs DDL, which the runtime role must never do (see SECURITY_MODEL).
 */
export interface PostgresAdminConnection {
  query(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ readonly rows?: readonly unknown[] } | unknown>;
}

export interface PostgresSchemaProvisionerOptions<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly admin: PostgresAdminConnection;
  /** The schema name for a tenant (validated as a SQL identifier). */
  readonly schema: (tenant: TTenant) => string;
  /**
   * Run YOUR migrator against the tenant's schema. TenancyJS never invokes an
   * ORM; when omitted, the provisioner exposes no `migrate` hook.
   */
  readonly migrate?: (
    tenant: TTenant,
    placement: Readonly<{ schema: string }>,
  ) => MaybePromise<void>;
}

export interface PostgresDatabaseProvisionerOptions<
  TTenant extends TenantRecord = TenantRecord,
> {
  /** Admin connection to a maintenance database (e.g. `postgres`). */
  readonly admin: PostgresAdminConnection;
  /** The database name for a tenant (validated as a SQL identifier). */
  readonly database: (tenant: TTenant) => string;
  readonly migrate?: (
    tenant: TTenant,
    placement: Readonly<{ database: string }>,
  ) => MaybePromise<void>;
}

/**
 * A batteries-included `TenancyProvisioner` for schema-per-tenant on PostgreSQL:
 * `provision` creates the tenant's schema (idempotent), `deprovision` drops it,
 * and `migrate` delegates to your migrator against that schema.
 */
export function createPostgresSchemaProvisioner<
  TTenant extends TenantRecord = TenantRecord,
>(
  options: PostgresSchemaProvisionerOptions<TTenant>,
): TenancyProvisioner<TTenant> {
  const resolve = (tenant: TTenant): string =>
    assertSqlIdentifier(options.schema(tenant), { label: "Tenant schema" });

  return Object.freeze({
    async provision(tenant: TTenant): Promise<void> {
      const schema = resolve(tenant);
      await options.admin.query(`create schema if not exists "${schema}"`);
    },
    async deprovision(tenant: TTenant): Promise<void> {
      const schema = resolve(tenant);
      await options.admin.query(`drop schema if exists "${schema}" cascade`);
    },
    ...(options.migrate === undefined
      ? {}
      : {
          async migrate(tenant: TTenant): Promise<void> {
            const schema = resolve(tenant);
            await options.migrate!(tenant, Object.freeze({ schema }));
          },
        }),
  });
}

/**
 * A batteries-included `TenancyProvisioner` for database-per-tenant on
 * PostgreSQL: `provision` creates the tenant's database if it does not exist,
 * `deprovision` drops it, and `migrate` delegates to your migrator.
 */
export function createPostgresDatabaseProvisioner<
  TTenant extends TenantRecord = TenantRecord,
>(
  options: PostgresDatabaseProvisionerOptions<TTenant>,
): TenancyProvisioner<TTenant> {
  const resolve = (tenant: TTenant): string =>
    assertSqlIdentifier(options.database(tenant), { label: "Tenant database" });

  return Object.freeze({
    async provision(tenant: TTenant): Promise<void> {
      const database = resolve(tenant);
      // CREATE DATABASE cannot run in a transaction or use `if not exists`, so
      // check the catalog first; a repeat call is a no-op.
      const result = await options.admin.query(
        "select 1 from pg_database where datname = $1",
        [database],
      );
      const exists = extractRows(result).length > 0;
      if (!exists) await options.admin.query(`create database "${database}"`);
    },
    async deprovision(tenant: TTenant): Promise<void> {
      const database = resolve(tenant);
      await options.admin.query(
        `drop database if exists "${database}" with (force)`,
      );
    },
    ...(options.migrate === undefined
      ? {}
      : {
          async migrate(tenant: TTenant): Promise<void> {
            const database = resolve(tenant);
            await options.migrate!(tenant, Object.freeze({ database }));
          },
        }),
  });
}

function extractRows(result: unknown): readonly unknown[] {
  if (
    result !== null &&
    typeof result === "object" &&
    "rows" in result &&
    Array.isArray((result as { rows: unknown }).rows)
  ) {
    return (result as { rows: readonly unknown[] }).rows;
  }
  return [];
}
