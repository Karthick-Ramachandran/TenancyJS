import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  rmdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

import { CliApplyError, CliConflictError, CliSecurityError } from "./errors.js";
import {
  assertNoSymlinkPath,
  isMissing,
  resolveContainedPath,
  resolveProjectRoot,
} from "./paths.js";
import type {
  ApplyChangePlanResult,
  ProjectChangeAction,
  ProjectChangePlan,
} from "./types.js";

interface ApplyHooks {
  beforeCommit?(
    action: ProjectChangeAction,
    index: number,
  ): void | Promise<void>;
}

export async function applyChangePlan(
  plan: ProjectChangePlan,
): Promise<ApplyChangePlanResult> {
  return applyChangePlanWithHooks(plan, {});
}

export async function applyChangePlanWithHooks(
  plan: ProjectChangePlan,
  hooks: ApplyHooks,
): Promise<ApplyChangePlanResult> {
  const root = await resolveProjectRoot(plan.root);
  if (root !== plan.root) {
    throw new CliSecurityError("Change plan root is not canonical.");
  }
  const conflicts = plan.actions
    .filter(({ status }) => status === "conflict")
    .map(({ path }) => path);
  if (conflicts.length > 0) throw new CliConflictError(conflicts);

  const seen = new Set<string>();
  const creates = plan.actions.filter(({ status }) => status === "create");
  for (const action of plan.actions) {
    if (seen.has(action.path)) {
      throw new CliSecurityError("Change plan contains duplicate paths.");
    }
    seen.add(action.path);
    const target = resolveContainedPath(root, action.path);
    await assertNoSymlinkPath(root, target, true);
    if (action.status === "unchanged") {
      const existing = await safeRead(target);
      if (existing !== action.content) {
        throw new CliConflictError([action.path]);
      }
    } else if (action.status === "create" && (await pathExists(target))) {
      throw new CliConflictError([action.path]);
    }
  }

  const staging = await mkdtemp(join(root, ".tenancy-staging-"));
  const staged = new Map<ProjectChangeAction, string>();
  const createdFiles: string[] = [];
  const createdDirectories: string[] = [];
  try {
    for (const [index, action] of creates.entries()) {
      const path = join(staging, String(index));
      await writeFile(path, action.content, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      staged.set(action, path);
    }
    for (const [index, action] of creates.entries()) {
      await hooks.beforeCommit?.(action, index);
      const target = resolveContainedPath(root, action.path);
      await createSafeParents(root, dirname(target), createdDirectories);
      await assertNoSymlinkPath(root, target, true);
      await link(staged.get(action)!, target);
      createdFiles.push(target);
    }
  } catch (error) {
    for (const path of createdFiles.reverse())
      await unlink(path).catch(() => undefined);
    for (const path of createdDirectories.reverse())
      await rmdir(path).catch(() => undefined);
    if (error instanceof CliConflictError || error instanceof CliSecurityError)
      throw error;
    if (isExists(error)) {
      throw new CliConflictError(creates.map(({ path }) => path));
    }
    throw new CliApplyError(
      "Unable to apply the change plan; generated writes were rolled back.",
      {
        cause: error,
      },
    );
  } finally {
    await rm(staging, { recursive: true, force: true });
  }

  return Object.freeze({
    created: Object.freeze(creates.map(({ path }) => path)),
    unchanged: Object.freeze(
      plan.actions
        .filter(({ status }) => status === "unchanged")
        .map(({ path }) => path),
    ),
  });
}

async function createSafeParents(
  root: string,
  parent: string,
  created: string[],
): Promise<void> {
  const segments = relative(root, parent).split(sep).filter(Boolean);
  let current = root;
  for (const segment of segments) {
    current = resolve(current, segment);
    try {
      const metadata = await lstat(current);
      if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
        throw new CliSecurityError(
          "Generated file parents must be real directories.",
        );
      }
    } catch (error) {
      if (!isMissing(error)) throw error;
      await mkdir(current, { mode: 0o755 });
      created.push(current);
    }
  }
}

async function safeRead(path: string): Promise<string> {
  return readFile(path, "utf8");
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

function isExists(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "EEXIST"
  );
}
