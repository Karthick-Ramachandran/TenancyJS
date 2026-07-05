import process from "node:process";

import { applyChangePlan } from "./apply.js";
import {
  FRAMEWORK_CHOICES,
  capabilityBanner,
  checkNodeVersion,
  ormForFramework,
} from "./capabilities.js";
import { runTenantCheck } from "./commands/check.js";
import {
  runProvisionAction,
  type ProvisionAction,
} from "./commands/provision.js";
import { runScript, type RunScope } from "./commands/run.js";
import {
  runTenantActivate,
  runTenantCreate,
  runTenantList,
  runTenantShow,
  runTenantSuspend,
} from "./commands/tenant.js";
import { detectProject } from "./detection.js";
import { CliProjectError, CliUsageError, TenancyCliError } from "./errors.js";
import { runDoctor } from "./doctor.js";
import { runLeakTest } from "./leak-test.js";
import {
  formatDoctor,
  formatJson,
  formatLeakTest,
  formatPlan,
  formatProvisionResult,
  formatRedactedJson,
  formatRunResult,
  formatTenantCheck,
  formatTenantList,
  formatTenantMutation,
  formatTenantShow,
} from "./output.js";
import { createInitPlan } from "./plan.js";
import { redactText } from "./redaction.js";
import { withRuntime } from "./runtime-command.js";
import type {
  InitFramework,
  ProjectChangePlan,
  ProjectDetection,
} from "./types.js";

export interface CliSelectChoice {
  readonly value: string;
  readonly label: string;
}

export interface CliIo {
  readonly cwd: string;
  writeStdout(value: string): void;
  writeStderr(value: string): void;
  /** True when stdin is an interactive TTY the CLI may prompt on. */
  readonly isInteractive?: boolean;
  /** Node version string; defaults to the running process. */
  readonly nodeVersion?: string;
  /** Present only in interactive mode; returns the chosen `value`. */
  select?(
    question: string,
    choices: readonly CliSelectChoice[],
  ): Promise<string>;
}

export async function runCli(
  arguments_: readonly string[],
  io: CliIo,
): Promise<number> {
  try {
    const parsed = parseArguments(arguments_);
    if (parsed.command === "help") {
      io.writeStdout(helpText());
      return 0;
    }
    const root = parsed.root ?? io.cwd;
    if (parsed.command === "init") {
      return await runInit(parsed, root, io);
    }
    if (parsed.command === "doctor") {
      const report = await runDoctor(root, {
        ...(parsed.testFile === undefined ? {} : { testFile: parsed.testFile }),
      });
      io.writeStdout(parsed.json ? formatJson(report) : formatDoctor(report));
      return report.status === "healthy"
        ? 0
        : report.status === "warnings"
          ? 1
          : 2;
    }
    if (parsed.command === "tenant") {
      return await runTenant(parsed, root, io);
    }
    if (parsed.command === "run") {
      return await runRun(parsed, root, io);
    }
    if (parsed.testFile === undefined) {
      throw new CliUsageError(
        "test:leak requires --test-file <relative JavaScript path>.",
      );
    }
    const result = await runLeakTest(root, parsed.testFile);
    io.writeStdout(parsed.json ? formatJson(result) : formatLeakTest(result));
    return result.status === "passed" ? 0 : 2;
  } catch (error) {
    const code =
      error instanceof TenancyCliError ? error.code : "TENANCY_CLI_UNEXPECTED";
    const message =
      error instanceof Error ? error.message : "Unexpected CLI failure.";
    const redacted = redactText(message);
    io.writeStderr(
      arguments_.includes("--json")
        ? formatJson({
            schemaVersion: 1,
            status: "error",
            error: { code, message: redacted },
          })
        : `Error: ${redacted}\n`,
    );
    return 2;
  }
}

async function runInit(
  parsed: ParsedArguments,
  root: string,
  io: CliIo,
): Promise<number> {
  const nodeVersion = io.nodeVersion ?? process.versions.node;
  if (!parsed.json) io.writeStderr(capabilityBanner(nodeVersion));

  const node = checkNodeVersion(nodeVersion);
  if (!node.ok) {
    throw new CliProjectError(
      `TenancyJS requires Node.js >= ${node.requiredMajor}, but this is Node ${node.current}. ` +
        `Upgrade Node, then run tenancy init again. No files were written.`,
    );
  }

  const detection = await detectProject(root);
  const framework = await resolveFramework(detection, parsed, io);
  const plan = await createInitPlan({
    root: detection.root,
    framework,
    orm: ormForFramework(framework),
  });

  if (parsed.apply) await applyChangePlan(plan);
  io.writeStdout(
    parsed.json
      ? formatJson(publicPlan(plan, parsed.apply))
      : formatPlan(plan, parsed.apply),
  );
  return plan.actions.some(({ status }) => status === "conflict") ? 2 : 0;
}

async function runTenant(
  parsed: ParsedArguments,
  root: string,
  io: CliIo,
): Promise<number> {
  const loadOptions = {
    root,
    ...(parsed.config === undefined ? {} : { configPath: parsed.config }),
  };
  if (parsed.subcommand === "check") {
    const result = await withRuntime(loadOptions, runTenantCheck);
    io.writeStdout(
      parsed.json ? formatRedactedJson(result) : formatTenantCheck(result),
    );
    return result.healthy ? 0 : 2;
  }
  if (parsed.subcommand === "list") {
    const result = await withRuntime(loadOptions, runTenantList);
    io.writeStdout(
      parsed.json ? formatRedactedJson(result) : formatTenantList(result),
    );
    return 0;
  }
  if (parsed.subcommand === "show") {
    const id = requireTenantId(parsed, "show");
    const result = await withRuntime(loadOptions, (runtime) =>
      runTenantShow(runtime, id),
    );
    io.writeStdout(
      parsed.json ? formatRedactedJson(result) : formatTenantShow(result),
    );
    return 0;
  }
  if (parsed.subcommand === "create") {
    // Validate --set before loading the runtime so bad args fail fast.
    const fields = parseSetFields(parsed.set);
    const result = await withRuntime(loadOptions, (runtime) =>
      runTenantCreate(runtime, {
        ...(parsed.tenantId === undefined ? {} : { id: parsed.tenantId }),
        fields,
      }),
    );
    io.writeStdout(
      parsed.json ? formatRedactedJson(result) : formatTenantMutation(result),
    );
    return 0;
  }
  if (parsed.subcommand === "suspend" || parsed.subcommand === "activate") {
    const id = requireTenantId(parsed, parsed.subcommand);
    const action =
      parsed.subcommand === "suspend" ? runTenantSuspend : runTenantActivate;
    const result = await withRuntime(loadOptions, (runtime) =>
      action(runtime, id),
    );
    io.writeStdout(
      parsed.json ? formatRedactedJson(result) : formatTenantMutation(result),
    );
    return 0;
  }
  if (
    parsed.subcommand === "provision" ||
    parsed.subcommand === "deprovision" ||
    parsed.subcommand === "migrate"
  ) {
    return await runProvision(parsed, parsed.subcommand, loadOptions, io);
  }
  throw new CliUsageError(
    `Unknown tenant subcommand: ${parsed.subcommand ?? "(none)"}. ` +
      'Use "tenant check", "list", "show <id>", "create [<id>]", "suspend <id>", ' +
      '"activate <id>", "provision <id>", "deprovision <id>", or "migrate <id|--all>".',
  );
}

async function runProvision(
  parsed: ParsedArguments,
  action: ProvisionAction,
  loadOptions: { root: string; configPath?: string },
  io: CliIo,
): Promise<number> {
  // Only `tenant migrate` may target every tenant (enforced in parseArguments);
  // provision/deprovision always resolve a single explicit id so a destructive
  // drop can never fan out by accident.
  const target =
    parsed.all && action === "migrate"
      ? ({ all: true } as const)
      : ({ id: requireTenantId(parsed, action) } as const);
  const result = await withRuntime(loadOptions, (runtime) =>
    runProvisionAction(runtime, action, target),
  );
  io.writeStdout(
    parsed.json ? formatRedactedJson(result) : formatProvisionResult(result),
  );
  return result.ok ? 0 : 2;
}

async function runRun(
  parsed: ParsedArguments,
  root: string,
  io: CliIo,
): Promise<number> {
  if (parsed.script === undefined) {
    throw new CliUsageError("run requires a <script> path.");
  }
  const scope = resolveRunScope(parsed);
  const loadOptions = {
    root,
    ...(parsed.config === undefined ? {} : { configPath: parsed.config }),
  };
  const result = await withRuntime(loadOptions, (runtime) =>
    runScript(runtime, { root, script: parsed.script!, scope }),
  );
  io.writeStdout(
    parsed.json ? formatRedactedJson(result) : formatRunResult(result),
  );
  return 0;
}

function resolveRunScope(parsed: ParsedArguments): RunScope {
  if (parsed.central && parsed.tenant !== undefined) {
    throw new CliUsageError("Use either --central or --tenant <id>, not both.");
  }
  if (parsed.central) return { mode: "central" };
  if (parsed.tenant !== undefined) {
    return { mode: "tenant", tenantId: parsed.tenant };
  }
  throw new CliUsageError(
    "run requires a scope: pass --tenant <id> or --central.",
  );
}

function requireTenantId(parsed: ParsedArguments, subcommand: string): string {
  if (parsed.tenantId === undefined) {
    throw new CliUsageError(`tenant ${subcommand} requires <id>.`);
  }
  return parsed.tenantId;
}

/** Turn repeated `--set key=value` into a plain field record. */
function parseSetFields(
  pairs: readonly string[] | undefined,
): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const pair of pairs ?? []) {
    const separator = pair.indexOf("=");
    if (separator <= 0) {
      throw new CliUsageError(`--set expects key=value, but got "${pair}".`);
    }
    fields[pair.slice(0, separator)] = pair.slice(separator + 1);
  }
  return fields;
}

async function resolveFramework(
  detection: ProjectDetection,
  parsed: ParsedArguments,
  io: CliIo,
): Promise<InitFramework> {
  if (parsed.framework !== undefined) return parsed.framework;

  if (detection.framework.supported && detection.framework.name !== "unknown") {
    if (!parsed.json) {
      io.writeStderr(
        `Detected ${detection.framework.name}${
          detection.framework.version === undefined
            ? ""
            : ` ${detection.framework.version}`
        }.\n`,
      );
    }
    return detection.framework.name;
  }

  const interactive =
    io.isInteractive === true &&
    typeof io.select === "function" &&
    !parsed.json &&
    !parsed.yes;

  if (interactive) {
    io.writeStderr(describeDetection(detection));
    const value = await io.select!(
      "Which framework are you setting up?",
      FRAMEWORK_CHOICES,
    );
    if (value !== "express" && value !== "adonis" && value !== "next") {
      throw new CliUsageError(
        `Unknown framework "${value}". Choose express, adonis, or next.`,
      );
    }
    return value;
  }

  throw new CliUsageError(
    "Could not detect a supported framework in this project. " +
      "Run tenancy init in an interactive terminal, or pass " +
      "--framework=express|adonis|next (supported: Express 5.2 + Prisma 7.8, " +
      "AdonisJS 7.3 + Lucid 22.4, Next.js 16 + Prisma 7.8).",
  );
}

function describeDetection(detection: ProjectDetection): string {
  const framework = detection.framework;
  if (framework.name === "unknown") {
    return "No supported framework was detected in package.json.\n";
  }
  return `Detected ${framework.name}${
    framework.version === undefined ? "" : ` ${framework.version}`
  }, which is outside the supported range.\n`;
}

interface ParsedArguments {
  readonly command: "init" | "doctor" | "test:leak" | "tenant" | "run" | "help";
  readonly subcommand?: string;
  readonly tenantId?: string;
  readonly script?: string;
  readonly tenant?: string;
  readonly central: boolean;
  readonly root?: string;
  readonly testFile?: string;
  readonly config?: string;
  readonly set?: readonly string[];
  readonly framework?: InitFramework;
  readonly apply: boolean;
  readonly all: boolean;
  readonly json: boolean;
  readonly yes: boolean;
}

const VALUE_FLAGS = new Set([
  "--root",
  "--test-file",
  "--framework",
  "--config",
  "--tenant",
]);

const OPERATIONAL_COMMANDS = new Set(["tenant", "run"]);

function parseArguments(arguments_: readonly string[]): ParsedArguments {
  const commandValue = arguments_[0] ?? "help";
  if (
    commandValue === "--help" ||
    commandValue === "-h" ||
    commandValue === "help"
  ) {
    return {
      command: "help",
      central: false,
      apply: false,
      all: false,
      json: false,
      yes: false,
    };
  }
  if (
    commandValue !== "init" &&
    commandValue !== "doctor" &&
    commandValue !== "test:leak" &&
    commandValue !== "tenant" &&
    commandValue !== "run"
  ) {
    throw new CliUsageError(`Unknown command: ${commandValue}`);
  }
  const positionals: string[] = [];
  const set: string[] = [];
  let root: string | undefined;
  let testFile: string | undefined;
  let config: string | undefined;
  let tenant: string | undefined;
  let framework: InitFramework | undefined;
  let apply = false;
  let central = false;
  let all = false;
  let json = false;
  let yes = false;
  for (let index = 1; index < arguments_.length; index += 1) {
    const argument = arguments_[index]!;
    if (argument === "--apply") apply = true;
    else if (argument === "--json") json = true;
    else if (argument === "--central") central = true;
    else if (argument === "--all") all = true;
    else if (argument === "--yes" || argument === "-y") yes = true;
    else if (argument === "--set") {
      const value = arguments_[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new CliUsageError("--set requires a key=value.");
      }
      set.push(value);
      index += 1;
    } else if (VALUE_FLAGS.has(argument)) {
      const value = arguments_[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new CliUsageError(`${argument} requires a value.`);
      }
      if (argument === "--root") root = value;
      else if (argument === "--test-file") testFile = value;
      else if (argument === "--config") config = value;
      else if (argument === "--tenant") tenant = value;
      else {
        if (value !== "express" && value !== "adonis" && value !== "next") {
          throw new CliUsageError(
            `Unknown framework "${value}". Choose express, adonis, or next.`,
          );
        }
        framework = value;
      }
      index += 1;
    } else if (argument.startsWith("--")) {
      throw new CliUsageError(`Unknown option: ${argument}`);
    } else {
      positionals.push(argument);
    }
  }
  if (!OPERATIONAL_COMMANDS.has(commandValue) && positionals.length > 0)
    throw new CliUsageError(`Unexpected argument: ${positionals[0]}`);
  if (commandValue === "run" && positionals.length > 1)
    throw new CliUsageError(`Unexpected argument: ${positionals[1]}`);
  // tenant takes at most <subcommand> <id>; reject stray extras rather than
  // silently ignoring them.
  if (commandValue === "tenant" && positionals.length > 2)
    throw new CliUsageError(`Unexpected argument: ${positionals[2]}`);
  if (commandValue !== "init" && apply)
    throw new CliUsageError("--apply is valid only for init.");
  if (commandValue !== "init" && (framework !== undefined || yes))
    throw new CliUsageError("--framework and --yes are valid only for init.");
  if (!OPERATIONAL_COMMANDS.has(commandValue) && config !== undefined)
    throw new CliUsageError(
      "--config is valid only for tenant and run commands.",
    );
  if (commandValue !== "tenant" && set.length > 0)
    throw new CliUsageError("--set is valid only for tenant create.");
  if (commandValue !== "run" && (central || tenant !== undefined))
    throw new CliUsageError(
      "--central and --tenant are valid only for the run command.",
    );
  if (all && !(commandValue === "tenant" && positionals[0] === "migrate"))
    throw new CliUsageError("--all is valid only for tenant migrate.");
  return {
    command: commandValue,
    ...(commandValue === "tenant" && positionals[0] !== undefined
      ? { subcommand: positionals[0] }
      : {}),
    ...(commandValue === "tenant" && positionals[1] !== undefined
      ? { tenantId: positionals[1] }
      : {}),
    ...(commandValue === "run" && positionals[0] !== undefined
      ? { script: positionals[0] }
      : {}),
    ...(tenant === undefined ? {} : { tenant }),
    ...(root === undefined ? {} : { root }),
    ...(testFile === undefined ? {} : { testFile }),
    ...(config === undefined ? {} : { config }),
    ...(set.length === 0 ? {} : { set }),
    ...(framework === undefined ? {} : { framework }),
    central,
    apply,
    all,
    json,
    yes,
  };
}

function publicPlan(plan: ProjectChangePlan, applied: boolean) {
  return {
    schemaVersion: 1,
    command: "init",
    mode: applied ? "apply" : "dry-run",
    framework: plan.framework,
    orm: plan.orm,
    strategy: plan.strategy,
    actions: plan.actions.map(({ path, status }) => ({ path, status })),
  } as const;
}

function helpText(): string {
  return `TenancyJS CLI

Usage:
  tenancy init [--framework <express|adonis|next>] [--root <path>] [--apply] [--yes] [--json]
  tenancy doctor [--root <path>] [--test-file <path>] [--json]
  tenancy test:leak --test-file <path> [--root <path>] [--json]
  tenancy tenant check [--config <path>] [--root <path>] [--json]
  tenancy tenant list [--config <path>] [--root <path>] [--json]
  tenancy tenant show <id> [--config <path>] [--root <path>] [--json]
  tenancy tenant create [<id>] [--set key=value ...] [--config <path>] [--json]
  tenancy tenant suspend <id> [--config <path>] [--json]
  tenancy tenant activate <id> [--config <path>] [--json]
  tenancy tenant provision <id> [--config <path>] [--json]
  tenancy tenant deprovision <id> [--config <path>] [--json]
  tenancy tenant migrate (<id> | --all) [--config <path>] [--json]
  tenancy run <script> (--tenant <id> | --central) [--config <path>] [--json]

init previews changes (dry run) unless --apply is present. It detects your stack and, when it cannot,
asks you to choose one interactively; pass --framework to skip the prompt in CI. Supported stacks:
Express 5.2 + Prisma 7.8, AdonisJS 7.3 + Lucid 22.4, or Next.js 16 + Prisma 7.8. Isolation is
single-database row-level (forced RLS); Node.js >= 24 is required.

tenant and run commands load your tenancy.config.ts at runtime (Node 24 strips types natively) to reach
the TenantStore, manager, and provisioner you passed to defineTenancyRuntime. Pass --config to point at
a non-default config path. run executes a script inside a tenant scope (--tenant <id>) or the central
scope (--central). provision/deprovision/migrate delegate to your runtime's provisioner hooks (the CLI
never invokes an ORM itself); tenant check reports any adapter/strategy that is not tested-supported.
`;
}
