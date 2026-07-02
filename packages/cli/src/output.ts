import { redactText } from "./redaction.js";
import type {
  DoctorReport,
  LeakTestResult,
  ProjectChangePlan,
} from "./types.js";

export function formatJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
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
