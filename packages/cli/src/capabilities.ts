import { bold, cyan, dim, magenta } from "./style.js";
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
    orm: "typeorm",
    ormLabel: "TypeORM",
    ormRange: "1.x",
  }),
  Object.freeze({
    framework: "express",
    frameworkLabel: "Express",
    frameworkRange: "5.2",
    orm: "sequelize",
    ormLabel: "Sequelize",
    ormRange: "6.37",
  }),
  Object.freeze({
    framework: "express",
    frameworkLabel: "Express",
    frameworkRange: "5.2",
    orm: "drizzle",
    ormLabel: "Drizzle",
    ormRange: "0.45",
  }),
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
  Object.freeze({
    framework: "next",
    frameworkLabel: "Next.js",
    frameworkRange: "16",
    orm: "typeorm",
    ormLabel: "TypeORM",
    ormRange: "1.x",
  }),
  Object.freeze({
    framework: "next",
    frameworkLabel: "Next.js",
    frameworkRange: "16",
    orm: "sequelize",
    ormLabel: "Sequelize",
    ormRange: "6.37",
  }),
  Object.freeze({
    framework: "next",
    frameworkLabel: "Next.js",
    frameworkRange: "16",
    orm: "drizzle",
    ormLabel: "Drizzle",
    ormRange: "0.45",
  }),
]);

/** npm package a framework's TenancyJS integration ships as. */
export const INTEGRATION_PACKAGE: Record<InitFramework, string> = Object.freeze(
  {
    express: "tenancyjs-integration-express",
    adonis: "tenancyjs-integration-adonis",
    next: "tenancyjs-integration-next",
  },
);

/** The ORM's own client package a stack needs installed alongside the adapter. */
export const ORM_PEER: Record<InitOrm, string> = Object.freeze({
  prisma: "@prisma/client",
  lucid: "@adonisjs/lucid",
  typeorm: "typeorm",
  sequelize: "sequelize",
  drizzle: "drizzle-orm",
});

/** Human display names, shared by the CLI banner, next-steps, and AI context. */
export const FRAMEWORK_LABEL: Record<InitFramework, string> = Object.freeze({
  express: "Express",
  adonis: "AdonisJS",
  next: "Next.js",
});
export const ORM_LABEL: Record<InitOrm, string> = Object.freeze({
  prisma: "Prisma",
  lucid: "Lucid",
  typeorm: "TypeORM",
  sequelize: "Sequelize",
  drizzle: "Drizzle",
});

export interface FrameworkChoice {
  readonly value: InitFramework;
  readonly label: string;
}

export const FRAMEWORK_CHOICES: readonly FrameworkChoice[] = Object.freeze(
  (["express", "adonis", "next"] as const).map((framework) => {
    const stack = SUPPORTED_STACKS.find(
      (entry) => entry.framework === framework,
    )!;
    return Object.freeze({
      value: framework,
      label: `${stack.frameworkLabel} ${stack.frameworkRange}`,
    });
  }),
);

export function ormChoicesForFramework(
  framework: InitFramework,
): readonly Readonly<{ value: InitOrm; label: string }>[] {
  return Object.freeze(
    SUPPORTED_STACKS.filter((stack) => stack.framework === framework).map(
      (stack) =>
        Object.freeze({
          value: stack.orm,
          label: `${stack.ormLabel} ${stack.ormRange}`,
        }),
    ),
  );
}

export function isSupportedStack(
  framework: InitFramework,
  orm: InitOrm,
): boolean {
  return SUPPORTED_STACKS.some(
    (stack) => stack.framework === framework && stack.orm === orm,
  );
}

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
  const sep = ` ${dim("·")} `;
  const frameworks = [
    ...new Set(SUPPORTED_STACKS.map((stack) => stack.frameworkLabel)),
  ].join(sep);
  const orms = [
    ...new Set(SUPPORTED_STACKS.map((stack) => stack.ormLabel)),
  ].join(sep);
  return [
    "",
    `  ${magenta("◆")} ${bold("TenancyJS")}  ${dim("fail-closed multi-tenancy")}`,
    "",
    `  ${dim("Stacks")}    ${frameworks}  ${dim("+")}  ${orms}`,
    `  ${dim("Strategy")}  ${cyan("row-level")} ${dim("(default)")}${sep}${cyan("schema-per-tenant")}${sep}${cyan("database-per-tenant")}   ${dim("— --strategy or pick interactively")}`,
    "",
    `  ${dim(`Node ${REQUIRED_NODE_MAJOR}+ · you have ${nodeVersion}`)}`,
    "",
  ].join("\n");
}
