import { lstat, readFile } from "node:fs/promises";

import { CliProjectError, CliSecurityError } from "./errors.js";
import {
  assertNoSymlinkPath,
  isMissing,
  resolveContainedPath,
} from "./paths.js";
import {
  ADONIS_LUCID_TEMPLATES,
  EXPRESS_PRISMA_TEMPLATES,
} from "./templates.js";
import type {
  ProjectChangeAction,
  ProjectChangePlan,
  ProjectDetection,
} from "./types.js";

export async function createInitPlan(
  detection: ProjectDetection,
): Promise<ProjectChangePlan> {
  if (!detection.supported) {
    throw new CliProjectError(
      "The initial CLI supports Express 5.2 with Prisma Client 7.8, or AdonisJS 7.3 with Lucid 22.4.",
    );
  }
  const isAdonis = detection.framework.name === "adonis";
  const templates = isAdonis
    ? ADONIS_LUCID_TEMPLATES
    : EXPRESS_PRISMA_TEMPLATES;
  const actions = await Promise.all(
    templates.map(async ({ path, content }) =>
      inspectAction(detection.root, path, content),
    ),
  );
  return Object.freeze({
    schemaVersion: 1,
    root: detection.root,
    framework: isAdonis ? "adonis" : "express",
    orm: isAdonis ? "lucid" : "prisma",
    strategy: "rowLevel",
    actions: Object.freeze(actions),
  });
}

async function inspectAction(
  root: string,
  path: string,
  content: string,
): Promise<ProjectChangeAction> {
  const target = resolveContainedPath(root, path);
  await assertNoSymlinkPath(root, target, true);
  try {
    const metadata = await lstat(target);
    if (metadata.isSymbolicLink()) {
      throw new CliSecurityError("Symlink destinations are not allowed.");
    }
    if (!metadata.isFile()) {
      return Object.freeze({ path, content, status: "conflict" });
    }
    const existing = await readFile(target, "utf8");
    return Object.freeze({
      path,
      content,
      status: existing === content ? "unchanged" : "conflict",
    });
  } catch (error) {
    if (isMissing(error))
      return Object.freeze({ path, content, status: "create" });
    throw error;
  }
}
