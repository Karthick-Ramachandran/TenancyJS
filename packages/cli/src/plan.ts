import { lstat, readFile } from "node:fs/promises";

import { CliSecurityError } from "./errors.js";
import {
  assertNoSymlinkPath,
  isMissing,
  resolveContainedPath,
} from "./paths.js";
import {
  ADONIS_LUCID_TEMPLATES,
  EXPRESS_DRIZZLE_TEMPLATES,
  EXPRESS_PRISMA_TEMPLATES,
  EXPRESS_SEQUELIZE_TEMPLATES,
  EXPRESS_TYPEORM_TEMPLATES,
  NEXT_PRISMA_TEMPLATES,
} from "./templates.js";
import type {
  InitFramework,
  InitOrm,
  ProjectChangeAction,
  ProjectChangePlan,
} from "./types.js";

type TemplateSet = readonly Readonly<{ path: string; content: string }>[];

const TEMPLATES: Readonly<Record<string, TemplateSet>> = Object.freeze({
  "express:prisma": EXPRESS_PRISMA_TEMPLATES,
  "express:typeorm": EXPRESS_TYPEORM_TEMPLATES,
  "express:sequelize": EXPRESS_SEQUELIZE_TEMPLATES,
  "express:drizzle": EXPRESS_DRIZZLE_TEMPLATES,
  "adonis:lucid": ADONIS_LUCID_TEMPLATES,
  "next:prisma": NEXT_PRISMA_TEMPLATES,
});

export interface ResolvedInitStack {
  readonly root: string;
  readonly framework: InitFramework;
  readonly orm: InitOrm;
}

export async function createInitPlan(
  stack: ResolvedInitStack,
): Promise<ProjectChangePlan> {
  const templates = TEMPLATES[`${stack.framework}:${stack.orm}`];
  if (templates === undefined)
    throw new TypeError(
      `Unsupported init stack: ${stack.framework} + ${stack.orm}.`,
    );
  const actions = await Promise.all(
    templates.map(async ({ path, content }) =>
      inspectAction(stack.root, path, content),
    ),
  );
  return Object.freeze({
    schemaVersion: 1,
    root: stack.root,
    framework: stack.framework,
    orm: stack.orm,
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
