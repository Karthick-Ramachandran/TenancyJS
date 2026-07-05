import type { InitFramework, InitOrm } from "./types.js";

export const REQUIRED_NODE_MAJOR = 24;

export interface SupportedStack {
  readonly framework: InitFramework;
  readonly frameworkLabel: string;
  readonly frameworkRange: string;
  readonly orm: InitOrm;
  readonly ormLabel: string;
  readonly ormRange: string;
}

export const SUPPORTED_STACKS: readonly SupportedStack[] = Object.freeze([
  Object.freeze({
    framework: "express",
    frameworkLabel: "Express",
    frameworkRange: "5.2",
    orm: "prisma",
    ormLabel: "Prisma",
    ormRange: "7.8",
  }),
  Object.freeze({
    framework: "adonis",
    frameworkLabel: "AdonisJS",
    frameworkRange: "7.3",
    orm: "lucid",
    ormLabel: "Lucid",
    ormRange: "22.4",
  }),
  Object.freeze({
    framework: "next",
    frameworkLabel: "Next.js",
    frameworkRange: "16",
    orm: "prisma",
    ormLabel: "Prisma",
    ormRange: "7.8",
  }),
]);

export interface FrameworkChoice {
  readonly value: InitFramework;
  readonly label: string;
}

export const FRAMEWORK_CHOICES: readonly FrameworkChoice[] = Object.freeze(
  SUPPORTED_STACKS.map((stack) =>
    Object.freeze({
      value: stack.framework,
      label: `${stack.frameworkLabel} ${stack.frameworkRange} + ${stack.ormLabel} ${stack.ormRange}`,
    }),
  ),
);

export function ormForFramework(framework: InitFramework): InitOrm {
  return framework === "adonis" ? "lucid" : "prisma";
}

export function parseNodeMajor(version: string): number {
  const major = Number.parseInt(
    version.replace(/^v/u, "").split(".")[0] ?? "",
    10,
  );
  return Number.isNaN(major) ? 0 : major;
}

export interface NodeVersionCheck {
  readonly ok: boolean;
  readonly requiredMajor: number;
  readonly current: string;
}

export function checkNodeVersion(version: string): NodeVersionCheck {
  return {
    ok: parseNodeMajor(version) >= REQUIRED_NODE_MAJOR,
    requiredMajor: REQUIRED_NODE_MAJOR,
    current: version,
  };
}

export function capabilityBanner(nodeVersion: string): string {
  const supported = SUPPORTED_STACKS.map(
    (stack) =>
      `  - ${stack.frameworkLabel} ${stack.frameworkRange} + ${stack.ormLabel} ${stack.ormRange}`,
  ).join("\n");
  return [
    "TenancyJS init",
    "",
    "Supported stacks:",
    supported,
    "Isolation strategies (all built and tested):",
    "  - Row-level (shared schema): forced Postgres RLS (Lucid/Knex) or query-scoping (Prisma).",
    "  - Schema-per-tenant: Postgres search_path (Knex/Lucid).",
    "  - Database-per-tenant: per-tenant connection (Knex/Lucid/Prisma).",
    "  init scaffolds row-level; schema/database-per-tenant are wired in code.",
    "Not yet supported: other frameworks/ORMs (roadmapped), MongoDB (not a goal),",
    "  and Prisma schema-per-tenant (deferred).",
    `Requires Node.js >= ${REQUIRED_NODE_MAJOR} (you have ${nodeVersion}).`,
    "",
  ].join("\n");
}
