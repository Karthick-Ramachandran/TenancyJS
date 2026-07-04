import type {
  TenancyAdapterValidationIssue,
  TenancyAdapterValidationResult,
  TenantRecord,
} from "@tenancyjs/core";

import type { LucidTenancyConfig } from "./config.js";
import { LUCID_CENTRAL_SETTING, LUCID_TENANT_SETTING } from "./config.js";

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

export async function validateLucidPolicies<TTenant extends TenantRecord>(
  config: LucidTenancyConfig<TTenant>,
): Promise<TenancyAdapterValidationResult> {
  const issues: TenancyAdapterValidationIssue[] = [];
  const roleRows = resultRows<RoleRow>(
    await config.database.rawQuery(ROLE_SQL),
  );
  const role = roleRows[0];
  if (role === undefined || role.rolsuper || role.rolbypassrls) {
    issues.push(
      issue(
        "TENANCY_LUCID_PRIVILEGED_ROLE",
        "The Lucid application role must not be superuser or BYPASSRLS.",
      ),
    );
  }

  const tableRows = resultRows<TableRow>(
    await config.database.rawQuery(TABLE_SQL, [
      config.tenantModels.map((model) => model.qualifiedName),
    ]),
  );
  for (const model of config.tenantModels) {
    const matching = tableRows.filter(
      (row) =>
        row.schema_name === model.schema && row.table_name === model.table,
    );
    if (matching.length === 0) {
      issues.push(
        issue(
          "TENANCY_LUCID_TABLE_MISSING",
          `Configured Lucid table "${model.qualifiedName}" was not found.`,
        ),
      );
      continue;
    }
    const first = matching[0]!;
    if (!first.rls_enabled || !first.rls_forced) {
      issues.push(
        issue(
          "TENANCY_LUCID_RLS_NOT_FORCED",
          `Tenant table "${model.qualifiedName}" must enable and force row-level security.`,
        ),
      );
    }
    if (role !== undefined && first.owner_name === role.role_name) {
      issues.push(
        issue(
          "TENANCY_LUCID_ROLE_OWNS_TABLE",
          `The runtime role must not own tenant table "${model.qualifiedName}".`,
        ),
      );
    }
    const policy = matching.find((row) => row.policy_name === model.policyName);
    if (
      policy === undefined ||
      policy.using_expression === null ||
      policy.check_expression === null ||
      !policy.using_expression.includes(LUCID_TENANT_SETTING) ||
      !policy.using_expression.includes(LUCID_CENTRAL_SETTING) ||
      !policy.check_expression.includes(LUCID_TENANT_SETTING) ||
      !policy.check_expression.includes(LUCID_CENTRAL_SETTING)
    ) {
      issues.push(
        issue(
          "TENANCY_LUCID_POLICY_INVALID",
          `Tenant table "${model.qualifiedName}" is missing the reviewed RLS policy contract.`,
        ),
      );
    }
  }

  return Object.freeze({
    valid: issues.length === 0,
    issues: Object.freeze(issues),
  });
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
