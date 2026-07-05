import type { TenantCheckResult } from "./commands/check.js";
import type { ProvisionResult } from "./commands/provision.js";
import type { RunScriptResult } from "./commands/run.js";
import type {
  TenantListResult,
  TenantMutationResult,
  TenantRecordView,
  TenantShowResult,
} from "./commands/tenant.js";
import { redactData, redactText } from "./redaction.js";
import type {
  DoctorReport,
  LeakTestResult,
  ProjectChangePlan,
} from "./types.js";

export function formatJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * Serialise operational-command output with structural redaction: the object
 * graph is deep-redacted by key name (and embedded credentials stripped) BEFORE
 * `JSON.stringify`, so `"password": "…"`-shaped secrets cannot slip through the
 * way a regex over serialised JSON would let them. Used by every command's
 * `--json` path.
 */
export function formatRedactedJson(value: unknown): string {
  return formatJson(redactData(value));
}

export function formatTenantList(result: TenantListResult): string {
  if (result.count === 0) return "No tenants found.\n";
  const lines = result.tenants.map((tenant) => describeTenant(tenant));
  lines.push(`${result.count} tenant${result.count === 1 ? "" : "s"}.`);
  return `${redactText(lines.join("\n"))}\n`;
}

export function formatTenantShow(result: TenantShowResult): string {
  return `${redactText(describeTenant(result.tenant, true))}\n`;
}

const MUTATION_VERB = {
  create: "created",
  suspend: "suspended",
  activate: "activated",
} as const;

export function formatTenantMutation(result: TenantMutationResult): string {
  const headline = `Tenant "${result.tenant.id}" ${MUTATION_VERB[result.subcommand]}.`;
  return `${redactText([headline, describeTenant(result.tenant, true)].join("\n"))}\n`;
}

export function formatTenantCheck(result: TenantCheckResult): string {
  const lines = result.checks.map(
    (check) => `${check.status.toUpperCase()} ${check.name}: ${check.detail}`,
  );
  lines.push(
    result.healthy
      ? "Tenancy runtime healthy."
      : "Tenancy runtime has failures.",
  );
  return `${redactText(lines.join("\n"))}\n`;
}

const PROVISION_VERB = {
  provision: "Provisioned",
  deprovision: "Deprovisioned",
  migrate: "Migrated",
} as const;

export function formatProvisionResult(result: ProvisionResult): string {
  const lines = result.results.map((outcome) =>
    outcome.status === "ok"
      ? `OK ${outcome.tenantId}`
      : `FAIL ${outcome.tenantId}: ${outcome.error ?? "failed"}`,
  );
  const okCount = result.results.filter((r) => r.status === "ok").length;
  lines.push(
    `${PROVISION_VERB[result.subcommand]} ${okCount}/${result.results.length} tenant(s).`,
  );
  return `${redactText(lines.join("\n"))}\n`;
}

export function formatRunResult(result: RunScriptResult): string {
  const scope =
    result.scope.mode === "central"
      ? "central scope"
      : `tenant "${result.scope.tenantId}"`;
  return `${redactText(`Ran ${result.script} in ${scope}.`)}\n`;
}

/**
 * Render a tenant as its id plus any top-level scalar fields (status, slug,
 * placement…). Nested/complex values are summarised, never dumped, so output
 * stays a stable one-liner (or a short block in `show`).
 */
function describeTenant(tenant: TenantRecordView, block = false): string {
  // Redact by key name first so secret fields never reach the rendered line,
  // regardless of the outer redactText pass (which only catches value shapes).
  const redacted = redactData(tenant) as Record<string, unknown>;
  const fields: string[] = [];
  for (const [key, value] of Object.entries(redacted)) {
    if (key === "id") continue;
    fields.push(`${key}=${describeValue(value)}`);
  }
  if (block) {
    return [`id: ${tenant.id}`, ...fields.map((field) => `  ${field}`)].join(
      "\n",
    );
  }
  return [tenant.id, ...fields].join("  ");
}

function describeValue(value: unknown): string {
  if (value === null) return "null";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.length} item(s)]`;
  return "{…}";
}

export function formatDoctor(report: DoctorReport): string {
  const lines = [`Tenancy Doctor: ${report.status.toUpperCase()}`];
  for (const item of report.findings) {
    lines.push(
      `${item.severity.toUpperCase()} ${item.code}${item.path === undefined ? "" : ` (${item.path})`}: ${item.message}`,
    );
  }
  lines.push(
    `Migration effort: ${report.migrationEffort.level} (${report.migrationEffort.score}; ${report.migrationEffort.affectedFiles} file(s))`,
  );
  return `${redactText(lines.join("\n"))}\n`;
}

export function formatPlan(plan: ProjectChangePlan, applied: boolean): string {
  const lines = [
    applied
      ? "Tenancy init applied."
      : "Tenancy init preview (no files written).",
  ];
  for (const action of plan.actions)
    lines.push(`${action.status.toUpperCase()} ${action.path}`);
  if (!applied) lines.push("Run with --apply to create non-conflicting files.");
  return `${lines.join("\n")}\n`;
}

export function formatLeakTest(result: LeakTestResult): string {
  const output = [
    `Tenancy leak test: ${result.status.toUpperCase()} (${result.testFile})`,
    result.stdout.trim(),
    result.stderr.trim(),
  ]
    .filter(Boolean)
    .join("\n");
  return `${redactText(output)}\n`;
}
