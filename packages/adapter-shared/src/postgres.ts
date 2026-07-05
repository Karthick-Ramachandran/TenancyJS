import type {
  TenancyAdapterValidationIssue,
  TenancyAdapterValidationResult,
  TenantContext,
  TenantRecord,
} from "@tenancyjs/core";

import { assertSqlIdentifier } from "./identifiers.js";

export const POSTGRES_TENANT_SETTING = "tenancyjs.tenant_id";
export const POSTGRES_CENTRAL_SETTING = "tenancyjs.is_central";

const ROLE_SQL = `
select current_user as role_name, rolname, rolsuper, rolbypassrls
from pg_roles where rolname = current_user
`;

const TABLE_SQL = `
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced,
       pg_get_userbyid(c.relowner) as owner_name,
       p.polname as policy_name,
       pg_get_expr(p.polqual, p.polrelid) as using_expression,
       pg_get_expr(p.polwithcheck, p.polrelid) as check_expression
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname || '.' || c.relname = any(?::text[])
`;

const SCHEMA_SQL = `
select n.nspname as schema_name,
       has_schema_privilege(current_user, n.oid, 'USAGE') as has_usage
from pg_namespace n
where n.nspname = ?
`;

const SCHEMA_TABLE_SQL = `
select c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = ? and c.relkind in ('r', 'p') and c.relname = any(?::text[])
`;

const DEFAULT_SEARCH_PATH_TABLE_SQL = `
select n.nspname as schema_name, c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = any(current_schemas(false))
  and c.relkind in ('r', 'p') and c.relname = any(?::text[])
`;

const SET_ROW_CONTEXT_SQL =
  "select set_config(?, ?, true), set_config(?, ?, true)";
const SET_SEARCH_PATH_SQL = "select set_config('search_path', ?, true)";
const SET_ROLE_SQL = "select set_config('role', ?, true)";

interface RoleRow {
  readonly role_name: string;
  readonly rolsuper: boolean;
  readonly rolbypassrls: boolean;
}

interface TableRow {
  readonly schema_name: string;
  readonly table_name: string;
  readonly rls_enabled: boolean;
  readonly rls_forced: boolean;
  readonly owner_name: string;
  readonly policy_name: string | null;
  readonly using_expression: string | null;
  readonly check_expression: string | null;
}

interface SchemaRow {
  readonly schema_name: string;
  readonly has_usage: boolean;
}

interface SchemaTableRow {
  readonly table_name: string;
}

export type PostgresBinding = string | number | boolean | string[];

export type PostgresExecutor = (
  sql: string,
  bindings?: readonly PostgresBinding[],
) => Promise<unknown>;

export interface PostgresRlsTable {
  readonly schema: string;
  readonly table: string;
  readonly qualifiedName: string;
  readonly policyName: string;
}

export interface PostgresValidationLabels {
  readonly codePrefix: `TENANCY_${string}`;
  readonly adapterName: string;
}

export interface PostgresRlsValidationOptions extends PostgresValidationLabels {
  readonly execute: PostgresExecutor;
  readonly tables: readonly PostgresRlsTable[];
  readonly tenantSetting?: string;
  readonly centralSetting?: string;
}

export interface PostgresSchemaStrategyOptions<
  TTenant extends TenantRecord = TenantRecord,
> extends PostgresValidationLabels {
  readonly resolveSchema: (tenant: TTenant) => string;
  readonly centralSchema?: string;
  readonly tenantTables: readonly string[];
  readonly centralTables?: readonly string[];
  /**
   * Optional database-enforced hardening: a per-tenant Postgres role holding
   * USAGE on only its own schema. When set, the tenant scope also
   * `SET LOCAL ROLE`s it, so the database itself blocks cross-schema access
   * (defense in depth beyond the adapter's search_path + no-raw rule).
   */
  readonly resolveRole?: (tenant: TTenant) => string;
}

export interface PostgresSchemaStrategyEngine<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly strategy: "schemaPerTenant";
  readonly centralSchema: string;
  validate(execute: PostgresExecutor): Promise<TenancyAdapterValidationResult>;
  applyContext(
    execute: PostgresExecutor,
    context: TenantContext<TTenant>,
  ): Promise<void>;
}

export class PostgresStrategyValidationError extends Error {
  constructor() {
    super("PostgreSQL tenancy strategy validation failed.");
    this.name = "PostgresStrategyValidationError";
  }
}

export async function validatePostgresRlsPolicies(
  options: PostgresRlsValidationOptions,
): Promise<TenancyAdapterValidationResult> {
  const issues: TenancyAdapterValidationIssue[] = [];
  const role = await validateRole(options.execute, options, issues);
  const tableRows = resultRows<TableRow>(
    await options.execute(TABLE_SQL, [
      options.tables.map((table) => table.qualifiedName),
    ]),
  );
  const tenantSetting = options.tenantSetting ?? POSTGRES_TENANT_SETTING;
  const centralSetting = options.centralSetting ?? POSTGRES_CENTRAL_SETTING;

  for (const table of options.tables) {
    const matching = tableRows.filter(
      (row) =>
        row.schema_name === table.schema && row.table_name === table.table,
    );
    if (matching.length === 0) {
      issues.push(
        issue(
          `${options.codePrefix}_TABLE_MISSING`,
          `Configured ${options.adapterName} table "${table.qualifiedName}" was not found.`,
        ),
      );
      continue;
    }
    const first = matching[0]!;
    if (!first.rls_enabled || !first.rls_forced) {
      issues.push(
        issue(
          `${options.codePrefix}_RLS_NOT_FORCED`,
          `Tenant table "${table.qualifiedName}" must enable and force row-level security.`,
        ),
      );
    }
    if (role !== undefined && first.owner_name === role.role_name) {
      issues.push(
        issue(
          `${options.codePrefix}_ROLE_OWNS_TABLE`,
          `The runtime role must not own tenant table "${table.qualifiedName}".`,
        ),
      );
    }
    const policy = matching.find((row) => row.policy_name === table.policyName);
    if (
      policy === undefined ||
      policy.using_expression === null ||
      policy.check_expression === null ||
      !policy.using_expression.includes(tenantSetting) ||
      !policy.using_expression.includes(centralSetting) ||
      !policy.check_expression.includes(tenantSetting) ||
      !policy.check_expression.includes(centralSetting)
    ) {
      issues.push(
        issue(
          `${options.codePrefix}_POLICY_INVALID`,
          `Tenant table "${table.qualifiedName}" is missing the reviewed RLS policy contract.`,
        ),
      );
    }
  }
  return validationResult(issues);
}

export async function applyPostgresRowContext(
  execute: PostgresExecutor,
  context: TenantContext,
): Promise<void> {
  await execute(SET_ROW_CONTEXT_SQL, [
    POSTGRES_TENANT_SETTING,
    context.mode === "tenant" ? context.tenant.id : "",
    POSTGRES_CENTRAL_SETTING,
    context.mode === "central" ? "true" : "false",
  ]);
}

export function createPostgresStrategyEngine<
  TTenant extends TenantRecord = TenantRecord,
>(
  options: PostgresSchemaStrategyOptions<TTenant>,
): PostgresSchemaStrategyEngine<TTenant> {
  if (typeof options.resolveSchema !== "function") {
    throw new TypeError("Schema-per-tenant requires a schema resolver.");
  }
  const centralSchema = assertSqlIdentifier(options.centralSchema ?? "public", {
    label: "Central schema",
  });
  const tenantTables = normalizeTableList(options.tenantTables, "Tenant table");
  const centralTables = normalizeTableList(
    options.centralTables === undefined ? [] : options.centralTables,
    "Central table",
  );

  return Object.freeze({
    strategy: "schemaPerTenant" as const,
    centralSchema,
    async validate(execute: PostgresExecutor) {
      const issues: TenancyAdapterValidationIssue[] = [];
      await validateRole(execute, options, issues);
      const central = await inspectSchema(
        execute,
        centralSchema,
        centralTables,
      );
      if (!central.exists || !central.hasUsage) {
        issues.push(
          issue(
            `${options.codePrefix}_CENTRAL_SCHEMA_INVALID`,
            `The configured central schema must exist and grant USAGE to the ${options.adapterName} runtime role.`,
          ),
        );
      }
      const shadowed = await existingTables(
        execute,
        centralSchema,
        tenantTables,
      );
      if (shadowed.length > 0) {
        issues.push(
          issue(
            `${options.codePrefix}_CENTRAL_SCHEMA_SHADOWS_TENANT_TABLE`,
            "The central schema must not contain configured tenant-table names.",
          ),
        );
      }
      const defaultPathShadowed = await defaultSearchPathTables(
        execute,
        tenantTables,
      );
      if (defaultPathShadowed.length > 0) {
        issues.push(
          issue(
            `${options.codePrefix}_DEFAULT_SEARCH_PATH_SHADOWS_TENANT_TABLE`,
            "The runtime role's default search path must not resolve configured tenant-table names.",
          ),
        );
      }
      if (central.missingTables.length > 0) {
        issues.push(
          issue(
            `${options.codePrefix}_CENTRAL_TABLE_MISSING`,
            "A configured central table was not found in the central schema.",
          ),
        );
      }
      return validationResult(issues);
    },
    async applyContext(
      execute: PostgresExecutor,
      context: TenantContext<TTenant>,
    ) {
      try {
        const schema =
          context.mode === "central"
            ? centralSchema
            : assertSqlIdentifier(options.resolveSchema(context.tenant), {
                label: "Tenant schema",
              });
        if (context.mode === "tenant" && schema === centralSchema) {
          throw new PostgresStrategyValidationError();
        }
        const tables = context.mode === "tenant" ? tenantTables : centralTables;
        const inspected = await inspectSchema(execute, schema, tables);
        if (
          !inspected.exists ||
          !inspected.hasUsage ||
          inspected.missingTables.length > 0
        ) {
          throw new PostgresStrategyValidationError();
        }
        await execute(SET_SEARCH_PATH_SQL, [schema]);
        if (context.mode === "tenant" && options.resolveRole !== undefined) {
          const role = assertSqlIdentifier(
            options.resolveRole(context.tenant),
            {
              label: "Tenant role",
            },
          );
          // Transaction-local role switch; reverts on commit. The role holds
          // USAGE on only its own schema, so the database blocks cross-schema
          // access even for a raw or schema-qualified query.
          await execute(SET_ROLE_SQL, [role]);
        }
      } catch (error) {
        if (error instanceof PostgresStrategyValidationError) throw error;
        throw new PostgresStrategyValidationError();
      }
    },
  });
}

async function validateRole(
  execute: PostgresExecutor,
  labels: PostgresValidationLabels,
  issues: TenancyAdapterValidationIssue[],
): Promise<RoleRow | undefined> {
  const role = resultRows<RoleRow>(await execute(ROLE_SQL))[0];
  if (role === undefined || role.rolsuper || role.rolbypassrls) {
    issues.push(
      issue(
        `${labels.codePrefix}_PRIVILEGED_ROLE`,
        `The ${labels.adapterName} application role must not be superuser or BYPASSRLS.`,
      ),
    );
  }
  return role;
}

async function inspectSchema(
  execute: PostgresExecutor,
  schema: string,
  tables: readonly string[],
): Promise<
  Readonly<{
    exists: boolean;
    hasUsage: boolean;
    missingTables: readonly string[];
  }>
> {
  const schemaRow = resultRows<SchemaRow>(
    await execute(SCHEMA_SQL, [schema]),
  )[0];
  const found = await existingTables(execute, schema, tables);
  return Object.freeze({
    exists: schemaRow !== undefined && schemaRow.schema_name === schema,
    hasUsage: schemaRow?.has_usage === true,
    missingTables: Object.freeze(
      tables.filter((table) => !found.includes(table)),
    ),
  });
}

async function existingTables(
  execute: PostgresExecutor,
  schema: string,
  tables: readonly string[],
): Promise<readonly string[]> {
  if (tables.length === 0) return Object.freeze([]);
  return Object.freeze(
    resultRows<SchemaTableRow>(
      await execute(SCHEMA_TABLE_SQL, [schema, [...tables]]),
    ).map((row) => row.table_name),
  );
}

async function defaultSearchPathTables(
  execute: PostgresExecutor,
  tables: readonly string[],
): Promise<readonly SchemaTableRow[]> {
  if (tables.length === 0) return Object.freeze([]);
  return Object.freeze(
    resultRows<SchemaTableRow>(
      await execute(DEFAULT_SEARCH_PATH_TABLE_SQL, [[...tables]]),
    ),
  );
}

function normalizeTableList(
  values: readonly string[],
  label: string,
): readonly string[] {
  if (!Array.isArray(values))
    throw new TypeError(`${label} names must be an array.`);
  const normalized = values.map((value) =>
    assertSqlIdentifier(value, { label }),
  );
  if (new Set(normalized).size !== normalized.length)
    throw new TypeError(`${label} names must be unique.`);
  return Object.freeze(normalized);
}

function resultRows<TRow>(result: unknown): readonly TRow[] {
  if (
    result !== null &&
    typeof result === "object" &&
    "rows" in result &&
    Array.isArray(result.rows)
  ) {
    return result.rows as readonly TRow[];
  }
  return Object.freeze([]);
}

function issue(code: string, message: string): TenancyAdapterValidationIssue {
  return Object.freeze({ code, severity: "error", message });
}

function validationResult(
  issues: TenancyAdapterValidationIssue[],
): TenancyAdapterValidationResult {
  return Object.freeze({
    valid: issues.length === 0,
    issues: Object.freeze(issues),
  });
}
