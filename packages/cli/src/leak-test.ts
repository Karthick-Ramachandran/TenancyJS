import { lstat, realpath } from "node:fs/promises";
import { extname, relative } from "node:path";
import { spawn } from "node:child_process";

import { CliProjectError, CliSecurityError } from "./errors.js";
import {
  assertNoSymlinkPath,
  resolveContainedPath,
  resolveProjectRoot,
} from "./paths.js";
import { redactText } from "./redaction.js";
import type { LeakTestResult } from "./types.js";

const ALLOWED_EXTENSIONS = new Set([".js", ".mjs", ".cjs"]);
const ALLOWED_ENVIRONMENT = new Set([
  "CI",
  "DATABASE_URL",
  "FORCE_COLOR",
  "NODE_ENV",
  "NO_COLOR",
  "TENANCY_CACHE_TTL",
  "TENANCY_STRATEGY",
  "TENANCY_STRICT",
  "TENANT_DATABASE_URL_TEMPLATE",
  "TEST_DATABASE_URL",
]);
const MAX_OUTPUT_LENGTH = 1_000_000;

export interface LeakTestOptions {
  readonly timeoutMs?: number;
}

export async function runLeakTest(
  root: string,
  testFile: string,
  options: LeakTestOptions = {},
): Promise<LeakTestResult> {
  const resolvedRoot = await resolveProjectRoot(root);
  const target = resolveContainedPath(resolvedRoot, testFile);
  await assertNoSymlinkPath(resolvedRoot, target, true);
  if (!ALLOWED_EXTENSIONS.has(extname(target))) {
    throw new CliSecurityError("Leak test must be a JavaScript file.");
  }
  const metadata = await lstat(target).catch((error: unknown) => {
    throw new CliProjectError("Leak test file does not exist.", {
      cause: error,
    });
  });
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new CliSecurityError("Leak test must be a regular non-symlink file.");
  }
  const canonical = await realpath(target);
  if (canonical !== target) {
    throw new CliSecurityError(
      "Leak test path must be canonical and contained.",
    );
  }

  const timeoutMs = options.timeoutMs ?? 120_000;
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 300_000
  ) {
    throw new CliProjectError(
      "Leak test timeout must be between 1 and 300000 milliseconds.",
    );
  }
  const child = await spawnNode(resolvedRoot, canonical, timeoutMs);
  return Object.freeze({
    schemaVersion: 1,
    command: "test:leak",
    status: child.exitCode === 0 ? "passed" : "failed",
    testFile: relative(resolvedRoot, canonical),
    exitCode: child.exitCode,
    stdout: redactText(child.stdout),
    stderr: redactText(child.stderr),
  });
}

function spawnNode(
  cwd: string,
  testFile: string,
  timeoutMs: number,
): Promise<{
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [testFile], {
      cwd,
      env: leakTestEnvironment(process.env),
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let forcedFailure: string | undefined;
    const timer = setTimeout(() => {
      forcedFailure = `Leak test exceeded ${timeoutMs}ms and was terminated.`;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout = appendBounded(stdout, chunk, () => {
        forcedFailure ??=
          "Leak test output exceeded the 1000000 character limit.";
      });
    });
    child.stderr.on("data", (chunk: string) => {
      stderr = appendBounded(stderr, chunk, () => {
        forcedFailure ??=
          "Leak test output exceeded the 1000000 character limit.";
      });
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      resolve({
        exitCode:
          forcedFailure === undefined ? (code ?? (signal === null ? 2 : 1)) : 2,
        stdout,
        stderr: `${stderr}${forcedFailure === undefined ? "" : `${forcedFailure}\n`}`,
      });
    });
  });
}

function leakTestEnvironment(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(source).filter(([name]) => ALLOWED_ENVIRONMENT.has(name)),
  );
}

export function appendBounded(
  current: string,
  chunk: string,
  onExceeded: () => void,
): string {
  const remaining = MAX_OUTPUT_LENGTH - current.length;
  if (chunk.length <= remaining) return current + chunk;
  onExceeded();
  return current + chunk.slice(0, Math.max(remaining, 0));
}
