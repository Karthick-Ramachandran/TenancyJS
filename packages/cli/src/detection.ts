import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { CliProjectError } from "./errors.js";
import { resolveProjectRoot } from "./paths.js";
import type {
  DetectedComponent,
  DetectedFramework,
  DetectedOrm,
  ProjectDetection,
} from "./types.js";

export async function detectProject(root: string): Promise<ProjectDetection> {
  const resolvedRoot = await resolveProjectRoot(root);
  const manifest = await readManifest(join(resolvedRoot, "package.json"));
  const dependencies = dependencyMap(manifest);
  const framework: DetectedComponent<DetectedFramework> =
    dependencies["@adonisjs/core"] !== undefined
      ? detectComponent(
          "adonis",
          dependencies["@adonisjs/core"],
          /(?:^|\D)7\.3(?:\D|$)/u,
        )
      : dependencies.next !== undefined
        ? detectComponent("next", dependencies.next, /(?:^|\D)16(?:\D|$)/u)
        : detectComponent(
            "express",
            dependencies.express,
            /(?:^|\D)5\.2(?:\D|$)/u,
          );
  const orm = detectOrm(dependencies);
  return Object.freeze({
    root: resolvedRoot,
    framework,
    orm,
    supported: framework.supported && orm.supported,
  });
}

function detectOrm(
  dependencies: Record<string, string>,
): DetectedComponent<DetectedOrm> {
  const candidates = [
    ["lucid", "@adonisjs/lucid", /(?:^|\D)22\.4(?:\D|$)/u],
    ["typeorm", "typeorm", /(?:^|\D)1(?:\D|$)/u],
    ["sequelize", "sequelize", /(?:^|\D)6\.37(?:\D|$)/u],
    ["drizzle", "drizzle-orm", /(?:^|\D)0\.45(?:\D|$)/u],
    ["prisma", "@prisma/client", /(?:^|\D)7\.8(?:\D|$)/u],
  ] as const;
  const installed = candidates.filter(
    ([, packageName]) => dependencies[packageName] !== undefined,
  );
  if (installed.length !== 1)
    return Object.freeze({ name: "unknown", supported: false });
  const [name, packageName, range] = installed[0]!;
  return detectComponent(name, dependencies[packageName], range);
}

function detectComponent<TName extends string>(
  name: TName,
  version: string | undefined,
  supportedPattern: RegExp,
): DetectedComponent<TName | "unknown"> {
  if (version === undefined) {
    return Object.freeze({
      name: "unknown",
      supported: false,
    }) as DetectedComponent<TName | "unknown">;
  }
  return Object.freeze({
    name,
    version,
    supported: supportedPattern.test(version),
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
