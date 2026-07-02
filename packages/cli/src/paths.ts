import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import { CliProjectError, CliSecurityError } from "./errors.js";

export async function resolveProjectRoot(root: string): Promise<string> {
  if (typeof root !== "string" || root.trim() === "") {
    throw new CliProjectError("Project root must be a non-empty path.");
  }
  try {
    const resolved = await realpath(root);
    const metadata = await lstat(resolved);
    if (!metadata.isDirectory()) {
      throw new CliProjectError("Project root must be a directory.");
    }
    return resolved;
  } catch (error) {
    if (error instanceof CliProjectError) throw error;
    throw new CliProjectError(
      "Project root does not exist or is inaccessible.",
      {
        cause: error,
      },
    );
  }
}

export function resolveContainedPath(root: string, candidate: string): string {
  if (
    typeof candidate !== "string" ||
    candidate.trim() === "" ||
    candidate.includes("\0") ||
    isAbsolute(candidate) ||
    candidate.split(/[\\/]/u).includes("..")
  ) {
    throw new CliSecurityError(
      "Project path must be a contained relative path.",
    );
  }
  const target = resolve(root, candidate);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new CliSecurityError("Project path escapes the project root.");
  }
  return target;
}

export async function assertNoSymlinkPath(
  root: string,
  target: string,
  includeTarget: boolean,
): Promise<void> {
  const relativePath = relative(root, target);
  const segments = relativePath.split(sep).filter(Boolean);
  const limit = includeTarget
    ? segments.length
    : Math.max(segments.length - 1, 0);
  let current = root;
  for (let index = 0; index < limit; index += 1) {
    current = resolve(current, segments[index]!);
    try {
      const metadata = await lstat(current);
      if (metadata.isSymbolicLink()) {
        throw new CliSecurityError("Symlink paths are not allowed.");
      }
      if (index < limit - 1 && !metadata.isDirectory()) {
        throw new CliSecurityError("A project path parent is not a directory.");
      }
    } catch (error) {
      if (isMissing(error)) return;
      throw error;
    }
  }
}

export function isMissing(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
