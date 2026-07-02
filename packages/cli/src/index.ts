export { applyChangePlan } from "./apply.js";
export { runCli } from "./cli.js";
export type { CliIo } from "./cli.js";
export { detectProject } from "./detection.js";
export { runDoctor } from "./doctor.js";
export type { DoctorOptions } from "./doctor.js";
export {
  CliApplyError,
  CliConflictError,
  CliProjectError,
  CliSecurityError,
  CliUsageError,
  TenancyCliError,
} from "./errors.js";
export type { CliErrorCode } from "./errors.js";
export { runLeakTest } from "./leak-test.js";
export type { LeakTestOptions } from "./leak-test.js";
export { createInitPlan } from "./plan.js";
export { redactText } from "./redaction.js";
export type {
  ApplyChangePlanResult,
  ChangeActionStatus,
  DetectedComponent,
  DetectedFramework,
  DetectedOrm,
  DoctorFinding,
  DoctorReport,
  DoctorSeverity,
  LeakTestResult,
  MigrationEffort,
  ProjectChangeAction,
  ProjectChangePlan,
  ProjectDetection,
} from "./types.js";
