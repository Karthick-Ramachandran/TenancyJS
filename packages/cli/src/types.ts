export type InitFramework = "express" | "adonis" | "next";
export type InitOrm = "prisma" | "lucid" | "typeorm" | "sequelize" | "drizzle";
export type InitStrategy = "rowLevel" | "schemaPerTenant" | "databasePerTenant";

export type DetectedFramework = InitFramework | "unknown";
export type DetectedOrm = InitOrm | "unknown";

export interface DetectedComponent<TName extends string> {
  readonly name: TName;
  readonly version?: string;
  readonly supported: boolean;
}

export interface ProjectDetection {
  readonly root: string;
  readonly framework: DetectedComponent<DetectedFramework>;
  readonly orm: DetectedComponent<DetectedOrm>;
  readonly supported: boolean;
}

export type ChangeActionStatus = "create" | "unchanged" | "conflict";

export interface ProjectChangeAction {
  readonly path: string;
  readonly content: string;
  readonly status: ChangeActionStatus;
}

export interface ProjectChangePlan {
  readonly schemaVersion: 1;
  readonly root: string;
  readonly framework: InitFramework;
  readonly orm: InitOrm;
  readonly strategy: InitStrategy;
  readonly actions: readonly ProjectChangeAction[];
}

export interface ApplyChangePlanResult {
  readonly created: readonly string[];
  readonly unchanged: readonly string[];
}

export type DoctorSeverity = "info" | "warning" | "error";

export interface DoctorFinding {
  readonly code: string;
  readonly severity: DoctorSeverity;
  readonly message: string;
  readonly path?: string;
  readonly occurrences?: number;
}

export interface MigrationEffort {
  readonly score: number;
  readonly level: "low" | "medium" | "high";
  readonly affectedFiles: number;
}

export interface DoctorReport {
  readonly schemaVersion: 1;
  readonly command: "doctor";
  readonly status: "healthy" | "warnings" | "errors";
  readonly detection: ProjectDetection;
  readonly findings: readonly DoctorFinding[];
  readonly migrationEffort: MigrationEffort;
  readonly summary: Readonly<{
    info: number;
    warnings: number;
    errors: number;
  }>;
}

export interface LeakTestResult {
  readonly schemaVersion: 1;
  readonly command: "test:leak";
  readonly status: "passed" | "failed";
  readonly testFile: string;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}
