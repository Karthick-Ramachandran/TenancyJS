import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { CliProjectError } from "./errors.js";
import { resolveProjectRoot } from "./paths.js";
import type { ProjectDetection } from "./types.js";

export async function detectProject(root: string): Promise<ProjectDetection> {
  const resolvedRoot = await resolveProjectRoot(root);
  const manifest = await readManifest(join(resolvedRoot, "package.json"));
  const dependencies = dependencyMap(manifest);
  const expressVersion = dependencies.express;
  const prismaVersion = dependencies["@prisma/client"];
  const framework = Object.freeze({
    name: expressVersion === undefined ? "unknown" : "express",
    ...(expressVersion === undefined ? {} : { version: expressVersion }),
    supported:
      expressVersion !== undefined &&
      /(?:^|\D)5\.2(?:\D|$)/u.test(expressVersion),
  } as const);
  const orm = Object.freeze({
    name: prismaVersion === undefined ? "unknown" : "prisma",
    ...(prismaVersion === undefined ? {} : { version: prismaVersion }),
    supported:
      prismaVersion !== undefined &&
      /(?:^|\D)7\.8(?:\D|$)/u.test(prismaVersion),
  } as const);
  return Object.freeze({
    root: resolvedRoot,
    framework,
    orm,
    supported: framework.supported && orm.supported,
  });
}

async function readManifest(path: string): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      throw new TypeError("Package manifest must be an object.");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new CliProjectError("Unable to read a valid project package.json.", {
      cause: error,
    });
  }
}

function dependencyMap(
  manifest: Record<string, unknown>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const field of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
  ] as const) {
    const value = manifest[field];
    if (value === null || typeof value !== "object" || Array.isArray(value))
      continue;
    for (const [name, version] of Object.entries(value)) {
      if (typeof version === "string" && !(name in result))
        result[name] = version;
    }
  }
  return result;
}
