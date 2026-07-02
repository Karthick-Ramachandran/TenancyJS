import { lstat, readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";

import { detectProject } from "./detection.js";
import { CliSecurityError } from "./errors.js";
import {
  assertNoSymlinkPath,
  isMissing,
  resolveContainedPath,
} from "./paths.js";
import type {
  DoctorFinding,
  DoctorReport,
  DoctorSeverity,
  MigrationEffort,
} from "./types.js";

const REQUIRED_FILES = [
  "tenancy.config.ts",
  "src/tenancy/register.ts",
  "src/middleware/tenancy.ts",
] as const;
const DEFAULT_LEAK_TESTS = [
  "test/tenancy.leak.test.mjs",
  "tests/tenancy.leak.test.mjs",
] as const;
const SOURCE_ROOTS = ["src", "app", "lib", "server"] as const;
const SKIPPED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".tenancy",
  "coverage",
  "dist",
  "generated",
  "node_modules",
]);
const SOURCE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
]);

export interface DoctorOptions {
  readonly testFile?: string;
}

export async function runDoctor(
  root: string,
  options: DoctorOptions = {},
): Promise<DoctorReport> {
  const detection = await detectProject(root);
  const findings: DoctorFinding[] = [];
  if (detection.framework.name !== "express") {
    findings.push(
      finding("UNSUPPORTED_FRAMEWORK", "error", "Express was not detected."),
    );
  } else if (!detection.framework.supported) {
    findings.push(
      finding(
        "UNSUPPORTED_EXPRESS_VERSION",
        "error",
        "Express must be in the tested 5.2 range.",
      ),
    );
  }
  if (detection.orm.name !== "prisma") {
    findings.push(
      finding("UNSUPPORTED_ORM", "error", "Prisma Client was not detected."),
    );
  } else if (!detection.orm.supported) {
    findings.push(
      finding(
        "UNSUPPORTED_PRISMA_VERSION",
        "error",
        "Prisma Client must be in the tested 7.8 range.",
      ),
    );
  }

  for (const path of REQUIRED_FILES) {
    if (!(await regularFileExists(detection.root, path))) {
      findings.push(
        finding(
          "MISSING_WIRING",
          "error",
          "Required tenancy wiring is missing.",
          path,
        ),
      );
    }
  }

  const leakTest =
    options.testFile ??
    (await firstExisting(detection.root, DEFAULT_LEAK_TESTS));
  if (leakTest === undefined) {
    findings.push(
      finding(
        "MISSING_LEAK_TEST",
        "error",
        "Configure an explicit JavaScript leak test before claiming isolation.",
      ),
    );
  } else if (!(await regularFileExists(detection.root, leakTest))) {
    findings.push(
      finding(
        "INVALID_LEAK_TEST",
        "error",
        "Leak test file is missing or unsafe.",
        leakTest,
      ),
    );
  }

  await inspectClassification(detection.root, findings);
  for (const sourceRoot of SOURCE_ROOTS) {
    const absolute = resolveContainedPath(detection.root, sourceRoot);
    if (await directoryExists(absolute)) {
      await scanDirectory(detection.root, absolute, findings);
    }
  }

  findings.sort(compareFindings);
  const summary = Object.freeze({
    info: findings.filter(({ severity }) => severity === "info").length,
    warnings: findings.filter(({ severity }) => severity === "warning").length,
    errors: findings.filter(({ severity }) => severity === "error").length,
  });
  return Object.freeze({
    schemaVersion: 1,
    command: "doctor",
    status:
      summary.errors > 0
        ? "errors"
        : summary.warnings > 0
          ? "warnings"
          : "healthy",
    detection,
    findings: Object.freeze(findings),
    migrationEffort: migrationEffort(findings),
    summary,
  });
}

async function inspectClassification(
  root: string,
  findings: DoctorFinding[],
): Promise<void> {
  const registerPath = "src/tenancy/register.ts";
  const schemaPath = "prisma/schema.prisma";
  const register = await optionalRead(root, registerPath);
  const schema = await optionalRead(root, schemaPath);
  if (register === undefined) return;
  if (
    !/tenantModels\s*:/u.test(register) ||
    !/centralModels\s*:/u.test(register)
  ) {
    findings.push(
      finding(
        "INCOMPLETE_MODEL_CLASSIFICATION",
        "error",
        "Prisma tenantModels and centralModels must both be explicit.",
        registerPath,
      ),
    );
    return;
  }
  if (schema === undefined) {
    findings.push(
      finding(
        "MISSING_PRISMA_SCHEMA",
        "error",
        "Prisma schema was not found.",
        schemaPath,
      ),
    );
    return;
  }
  const models = [
    ...schema.matchAll(/^model\s+([A-Za-z][A-Za-z0-9_]*)\s*\{/gmu),
  ].map((match) => match[1]!);
  const missing = models.filter(
    (model) => !new RegExp(`\\b${model}\\s*:`, "u").test(register),
  );
  if (missing.length > 0) {
    findings.push(
      finding(
        "INCOMPLETE_MODEL_CLASSIFICATION",
        "error",
        `Prisma model classification is incomplete (${missing.length} model(s)).`,
        registerPath,
        missing.length,
      ),
    );
  } else {
    findings.push(
      finding(
        "MANUAL_MODEL_CLASSIFICATION",
        "warning",
        "Model/relation classification remains a manual schema-review boundary.",
        registerPath,
      ),
    );
  }
}

async function scanDirectory(
  root: string,
  directory: string,
  findings: DoctorFinding[],
): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".env") || SKIPPED_DIRECTORIES.has(entry.name))
      continue;
    const absolute = join(directory, entry.name);
    const path = relative(root, absolute);
    if (entry.isSymbolicLink()) {
      findings.push(
        finding(
          "SOURCE_SYMLINK_SKIPPED",
          "warning",
          "Source symlink was not scanned.",
          path,
        ),
      );
      continue;
    }
    if (entry.isDirectory()) {
      await scanDirectory(root, absolute, findings);
      continue;
    }
    if (!entry.isFile() || !SOURCE_EXTENSIONS.has(extname(entry.name)))
      continue;
    const metadata = await lstat(absolute);
    if (metadata.size > 1_000_000) {
      findings.push(
        finding(
          "LARGE_SOURCE_SKIPPED",
          "warning",
          "Large source file was not scanned.",
          path,
        ),
      );
      continue;
    }
    const content = await readFile(absolute, "utf8");
    inspectSource(path, content, findings);
  }
}

function inspectSource(
  path: string,
  content: string,
  findings: DoctorFinding[],
): void {
  const clients = countMatches(content, /new\s+PrismaClient\s*\(/gu);
  if (clients > 0) {
    const protectedInFile =
      /\$extends\s*\(/u.test(content) &&
      /createPrismaTenancyExtension/u.test(content);
    findings.push(
      finding(
        protectedInFile ? "BASE_CLIENT_REVIEW" : "UNEXTENDED_PRISMA_CLIENT",
        protectedInFile ? "warning" : "error",
        protectedInFile
          ? "Base Prisma client construction requires confinement review."
          : "Prisma client construction has no visible TenancyJS extension.",
        path,
        clients,
      ),
    );
  }
  const raw = countMatches(content, /\$(?:queryRaw|executeRaw)(?:Unsafe)?\b/gu);
  if (raw > 0) {
    findings.push(
      finding(
        "UNSAFE_RAW_PRISMA",
        "error",
        "Raw Prisma operations are outside the adapter guarantee.",
        path,
        raw,
      ),
    );
  }
  const relations = countMatches(content, /\b(?:include|select)\s*:\s*\{/gu);
  if (relations > 0) {
    findings.push(
      finding(
        "RELATION_OPERATION_REVIEW",
        "warning",
        "Prisma relation selection requires migration to supported top-level operations.",
        path,
        relations,
      ),
    );
  }
  const nested = countMatches(
    content,
    /\b(?:create|connect|upsert|update)\s*:\s*\{/gu,
  );
  if (nested > 0) {
    findings.push(
      finding(
        "NESTED_OPERATION_REVIEW",
        "warning",
        "Possible nested Prisma write requires manual review.",
        path,
        nested,
      ),
    );
  }
}

function finding(
  code: string,
  severity: DoctorSeverity,
  message: string,
  path?: string,
  occurrences?: number,
): DoctorFinding {
  return Object.freeze({
    code,
    severity,
    message,
    ...(path === undefined ? {} : { path }),
    ...(occurrences === undefined ? {} : { occurrences }),
  });
}

function migrationEffort(findings: readonly DoctorFinding[]): MigrationEffort {
  const weights: Record<DoctorSeverity, number> = {
    info: 0,
    warning: 2,
    error: 6,
  };
  const score = findings.reduce(
    (total, item) => total + weights[item.severity] * (item.occurrences ?? 1),
    0,
  );
  return Object.freeze({
    score,
    level: score > 30 ? "high" : score > 10 ? "medium" : "low",
    affectedFiles: new Set(
      findings.flatMap(({ path }) => (path === undefined ? [] : [path])),
    ).size,
  });
}

async function optionalRead(
  root: string,
  path: string,
): Promise<string | undefined> {
  const absolute = resolveContainedPath(root, path);
  try {
    await assertNoSymlinkPath(root, absolute, true);
    return await readFile(absolute, "utf8");
  } catch (error) {
    if (isMissing(error) || error instanceof CliSecurityError) return undefined;
    throw error;
  }
}

async function regularFileExists(root: string, path: string): Promise<boolean> {
  try {
    const absolute = resolveContainedPath(root, path);
    await assertNoSymlinkPath(root, absolute, true);
    const metadata = await lstat(absolute);
    return metadata.isFile() && !metadata.isSymbolicLink();
  } catch (error) {
    if (isMissing(error) || error instanceof CliSecurityError) return false;
    throw error;
  }
}

async function firstExisting(
  root: string,
  paths: readonly string[],
): Promise<string | undefined> {
  for (const path of paths)
    if (await regularFileExists(root, path)) return path;
  return undefined;
}

async function directoryExists(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isDirectory();
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

function countMatches(content: string, pattern: RegExp): number {
  return [...content.matchAll(pattern)].length;
}

function compareFindings(first: DoctorFinding, second: DoctorFinding): number {
  const order: Record<DoctorSeverity, number> = {
    error: 0,
    warning: 1,
    info: 2,
  };
  return (
    order[first.severity] - order[second.severity] ||
    first.code.localeCompare(second.code) ||
    (first.path ?? "").localeCompare(second.path ?? "")
  );
}
