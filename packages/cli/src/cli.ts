import process from "node:process";

import { applyAiContext, type AiContextResult } from "./ai-context.js";
import { applyChangePlan } from "./apply.js";
import { bold, cyan, dim, green, yellow } from "./style.js";
import {
  FRAMEWORK_CHOICES,
  FRAMEWORK_LABEL,
  INTEGRATION_PACKAGE,
  ORM_LABEL,
  ORM_PEER,
  capabilityBanner,
  checkNodeVersion,
  isSupportedStack,
  ormChoicesForFramework,
} from "./capabilities.js";
import { runTenantCheck } from "./commands/check.js";
import {
  runProvisionAction,
  type ProvisionAction,
} from "./commands/provision.js";
import { runPolicy } from "./commands/policy.js";
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
  InitOrm,
  InitStrategy,
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
    if (parsed.command === "policy") {
      const result = runPolicy({
        tables: parsed.tables ?? [],
        role: parsed.role ?? "",
        ...(parsed.tenantColumn === undefined
          ? {}
          : { tenantColumn: parsed.tenantColumn }),
        ...(parsed.out === undefined ? {} : { out: parsed.out }),
        json: parsed.json,
        root,
      });
      io.writeStdout(parsed.json ? formatJson(result) : result.sql);
      return 0;
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
  const orm = await resolveOrm(detection, framework, parsed, io);
  // Confirm the opt-in AI context before writing anything, so all prompts happen
  // together. Only meaningful with --apply, which is what actually writes files.
  const wantAiContext = parsed.apply
    ? await resolveAiContext(parsed, io)
    : false;
  const plan = await createInitPlan({
    root: detection.root,
    framework,
    orm,
    ...(parsed.strategy === undefined ? {} : { strategy: parsed.strategy }),
  });

  if (parsed.apply) await applyChangePlan(plan);
  const aiContext = wantAiContext
    ? await applyAiContext({ root: detection.root, framework, orm })
    : undefined;
  io.writeStdout(
    parsed.json
      ? formatJson(publicPlan(plan, parsed.apply, aiContext))
      : formatPlan(plan, parsed.apply),
  );
  if (parsed.apply && !parsed.json) {
    io.writeStdout(formatNextSteps(framework, orm));
    if (aiContext !== undefined) io.writeStdout(formatAiContext(aiContext));
  }
  return plan.actions.some(({ status }) => status === "conflict") ? 2 : 0;
}

/** True when the user opted into the AI context file — explicit flag or a yes. */
async function resolveAiContext(
  parsed: ParsedArguments,
  io: CliIo,
): Promise<boolean> {
  if (parsed.aiContext) return true;
  const interactive =
    io.isInteractive === true &&
    typeof io.select === "function" &&
    !parsed.json &&
    !parsed.yes;
  if (!interactive) return false;
  const value = await io.select!(
    "Also generate an AI context file (TENANCY.md) and register it in AGENTS.md / CLAUDE.md?",
    [
      { value: "yes", label: "Yes — write TENANCY.md and update agent memory" },
      { value: "no", label: "No, skip it" },
    ],
  );
  return value === "yes";
}

/** Human summary of what the AI-context step wrote. */
function formatAiContext(result: AiContextResult): string {
  const lines = [""];
  if (result.guide === "created")
    lines.push(
      `  ${green("✔")}  Wrote ${bold("TENANCY.md")} ${dim("— AI context for this stack")}`,
    );
  else if (result.guide === "unchanged")
    lines.push(
      `  ${dim("•")}  ${bold("TENANCY.md")} ${dim("already current")}`,
    );
  else
    lines.push(
      `  ${yellow("•")}  ${bold("TENANCY.md")} ${dim("exists and differs — left unchanged")}`,
    );
  for (const update of result.memory)
    lines.push(
      `  ${green("✔")}  ${update.action === "added" ? "Added" : "Updated"} the TenancyJS block in ${bold(update.path)}`,
    );
  if (result.noMemoryFound)
    lines.push(
      `  ${dim("·")} ${dim("No AGENTS.md or CLAUDE.md found — paste TENANCY.md's summary into your agent memory to give AI tools this context.")}`,
    );
  lines.push("");
  return `${lines.join("\n")}\n`;
}

/** Concrete, copy-pasteable "what to do next" after `init --apply`. */
function formatNextSteps(framework: InitFramework, orm: InitOrm): string {
  const packages = [
    "tenancyjs-core",
    `tenancyjs-adapter-${orm}`,
    INTEGRATION_PACKAGE[framework],
    "tenancyjs-identifiers",
    ORM_PEER[orm],
  ].join(" ");
  const docs = "https://tenancyjs.pages.dev/docs";
  const step = (n: number, title: string) =>
    `\n  ${cyan(bold(String(n)))}  ${bold(title)}`;
  const cmd = (value: string) => `     ${cyan(value)}`;
  const note = (value: string) => `     ${dim("·")} ${value}`;
  const link = (value: string) => `     ${dim("→")} ${cyan(value)}`;

  const out: string[] = [
    "",
    `  ${green("✔")}  Scaffolded ${bold(`${FRAMEWORK_LABEL[framework]} + ${ORM_LABEL[orm]}`)}`,
    "",
    `  ${bold("Next steps")}`,
    step(1, "Install the packages"),
    cmd(`npm install ${packages}`),
    step(2, "Fill in the scaffolded files"),
    note("point the resolver's store at your tenant table"),
    note("register each tenant-scoped model/table with the adapter"),
  ];

  if (framework === "adonis")
    out.push(
      step(3, "Register the provider + tenant middleware"),
      link(`${docs}/integrations/adonis#register-the-provider-and-middleware`),
    );
  else if (framework === "express")
    out.push(
      step(3, "Mount the middleware with a TenantResolutionChain resolver"),
      link(`${docs}/integrations/express`),
    );
  else
    out.push(
      step(
        3,
        "Add the edge middleware.ts, wrap handlers with withRouteHandler",
      ),
      link(`${docs}/integrations/nextjs`),
    );

  if (orm === "prisma")
    out.push(
      step(
        4,
        "Classify your models — Prisma row-level is facade-only (no RLS SQL)",
      ),
    );
  else
    out.push(
      step(4, "Set up forced Postgres RLS"),
      note(
        "create a non-bypass runtime role + a <table>_tenant_isolation policy (ENABLE + FORCE)",
      ),
      link(`${docs}/strategies/row-level#the-rls-backstop`),
    );

  out.push(
    step(5, "Provision, migrate, then prove isolation"),
    cmd("npx tenancy tenant check"),
    cmd("npx tenancy test:leak --test-file <path>"),
    "",
    `  ${dim("Full walkthrough")}  ${cyan(`${docs}/getting-started/quickstart`)}`,
    "",
  );
  return out.join("\n");
}

async function resolveOrm(
  detection: ProjectDetection,
  framework: InitFramework,
  parsed: ParsedArguments,
  io: CliIo,
): Promise<InitOrm> {
  if (parsed.orm !== undefined) {
    if (!isSupportedStack(framework, parsed.orm))
      throw new CliUsageError(
        `Unsupported init stack: ${framework} + ${parsed.orm}.`,
      );
    return parsed.orm;
  }
  if (
    detection.orm.supported &&
    detection.orm.name !== "unknown" &&
    isSupportedStack(framework, detection.orm.name)
  )
    return detection.orm.name;

  const choices = ormChoicesForFramework(framework);
  if (choices.length === 1) return choices[0]!.value;
  const interactive =
    io.isInteractive === true &&
    typeof io.select === "function" &&
    !parsed.json &&
    !parsed.yes;
  if (interactive) {
    const value = await io.select!("Which ORM are you setting up?", choices);
    if (!isInitOrm(value) || !isSupportedStack(framework, value))
      throw new CliUsageError(`Unknown ORM "${value}" for ${framework}.`);
    return value;
  }
  throw new CliUsageError(
    `Could not detect a supported ORM for ${framework}. Pass --orm=${choices.map((choice) => choice.value).join("|")}.`,
  );
}

function isInitOrm(value: string): value is InitOrm {
  return (
    value === "prisma" ||
    value === "lucid" ||
    value === "typeorm" ||
    value === "sequelize" ||
    value === "drizzle"
  );
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
  readonly command:
    "init" | "doctor" | "test:leak" | "tenant" | "run" | "policy" | "help";
  readonly subcommand?: string;
  readonly tenantId?: string;
  readonly script?: string;
  readonly tenant?: string;
  readonly central: boolean;
  readonly root?: string;
  readonly testFile?: string;
  readonly config?: string;
  readonly set?: readonly string[];
  readonly tables?: readonly string[];
  readonly role?: string;
  readonly tenantColumn?: string;
  readonly out?: string;
  readonly framework?: InitFramework;
  readonly orm?: InitOrm;
  readonly strategy?: InitStrategy;
  readonly apply: boolean;
  readonly all: boolean;
  readonly json: boolean;
  readonly yes: boolean;
  readonly aiContext: boolean;
}

const VALUE_FLAGS = new Set([
  "--root",
  "--test-file",
  "--framework",
  "--orm",
  "--config",
  "--tenant",
  "--role",
  "--tenant-column",
  "--out",
  "--strategy",
]);

const STRATEGY_ALIASES: Readonly<Record<string, InitStrategy>> = Object.freeze({
  "row-level": "rowLevel",
  rowlevel: "rowLevel",
  "schema-per-tenant": "schemaPerTenant",
  schema: "schemaPerTenant",
  "database-per-tenant": "databasePerTenant",
  database: "databasePerTenant",
});

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
      aiContext: false,
    };
  }
  if (
    commandValue !== "init" &&
    commandValue !== "doctor" &&
    commandValue !== "test:leak" &&
    commandValue !== "tenant" &&
    commandValue !== "run" &&
    commandValue !== "policy"
  ) {
    throw new CliUsageError(`Unknown command: ${commandValue}`);
  }
  const positionals: string[] = [];
  const set: string[] = [];
  const tables: string[] = [];
  let role: string | undefined;
  let tenantColumn: string | undefined;
  let out: string | undefined;
  let root: string | undefined;
  let testFile: string | undefined;
  let config: string | undefined;
  let tenant: string | undefined;
  let framework: InitFramework | undefined;
  let orm: InitOrm | undefined;
  let strategy: InitStrategy | undefined;
  let apply = false;
  let central = false;
  let all = false;
  let json = false;
  let yes = false;
  let aiContext = false;
  for (let index = 1; index < arguments_.length; index += 1) {
    const argument = arguments_[index]!;
    if (argument === "--apply") apply = true;
    else if (argument === "--json") json = true;
    else if (argument === "--central") central = true;
    else if (argument === "--all") all = true;
    else if (argument === "--yes" || argument === "-y") yes = true;
    else if (argument === "--ai-context") aiContext = true;
    else if (argument === "--set") {
      const value = arguments_[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new CliUsageError("--set requires a key=value.");
      }
      set.push(value);
      index += 1;
    } else if (argument === "--table") {
      const value = arguments_[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new CliUsageError("--table requires a table name.");
      }
      tables.push(value);
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
      else if (argument === "--role") role = value;
      else if (argument === "--tenant-column") tenantColumn = value;
      else if (argument === "--out") out = value;
      else if (argument === "--strategy") {
        const mapped = STRATEGY_ALIASES[value.toLowerCase()];
        if (mapped === undefined) {
          throw new CliUsageError(
            `Unknown strategy "${value}". Choose row-level, schema-per-tenant, or database-per-tenant.`,
          );
        }
        strategy = mapped;
      } else if (argument === "--framework") {
        if (value !== "express" && value !== "adonis" && value !== "next") {
          throw new CliUsageError(
            `Unknown framework "${value}". Choose express, adonis, or next.`,
          );
        }
        framework = value;
      } else {
        if (!isInitOrm(value))
          throw new CliUsageError(
            `Unknown ORM "${value}". Choose prisma, lucid, typeorm, sequelize, or drizzle.`,
          );
        orm = value;
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
  if (
    commandValue !== "init" &&
    (framework !== undefined ||
      orm !== undefined ||
      strategy !== undefined ||
      yes ||
      aiContext)
  )
    throw new CliUsageError(
      "--framework, --orm, --strategy, --yes, and --ai-context are valid only for init.",
    );
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
  if (
    commandValue !== "policy" &&
    (tables.length > 0 ||
      role !== undefined ||
      tenantColumn !== undefined ||
      out !== undefined)
  )
    throw new CliUsageError(
      "--table, --role, --tenant-column, and --out are valid only for the policy command.",
    );
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
    ...(tables.length === 0 ? {} : { tables }),
    ...(role === undefined ? {} : { role }),
    ...(tenantColumn === undefined ? {} : { tenantColumn }),
    ...(out === undefined ? {} : { out }),
    ...(framework === undefined ? {} : { framework }),
    ...(orm === undefined ? {} : { orm }),
    ...(strategy === undefined ? {} : { strategy }),
    central,
    apply,
    all,
    json,
    yes,
    aiContext,
  };
}

function publicPlan(
  plan: ProjectChangePlan,
  applied: boolean,
  aiContext?: AiContextResult,
) {
  return {
    schemaVersion: 1,
    command: "init",
    mode: applied ? "apply" : "dry-run",
    framework: plan.framework,
    orm: plan.orm,
    strategy: plan.strategy,
    actions: plan.actions.map(({ path, status }) => ({ path, status })),
    ...(aiContext === undefined
      ? {}
      : {
          aiContext: {
            guide: aiContext.guide,
            memory: aiContext.memory.map(({ path, action }) => ({
              path,
              action,
            })),
          },
        }),
  } as const;
}

function helpText(): string {
  return `TenancyJS CLI

Usage:
  tenancy init [--framework <express|adonis|next>] [--orm <prisma|lucid|typeorm|sequelize|drizzle>] [--strategy <row-level|schema-per-tenant|database-per-tenant>] [--root <path>] [--apply] [--ai-context] [--yes] [--json]
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
  tenancy policy --table <name> [--table <name> ...] --role <runtime-role> [--tenant-column <col>] [--out <file>] [--json]

init previews changes (dry run) unless --apply is present. It detects your stack and, when it cannot,
asks you to choose one interactively; pass --framework and --orm to skip prompts in CI. Express 5.2
supports Prisma 7.8, TypeORM 1, Sequelize 6.37, and Drizzle 0.45 scaffolds; AdonisJS 7.3 uses Lucid
22.4 and Next.js 16 uses Prisma 7.8. Init scaffolds row-level by default; pass --strategy for
schema-per-tenant or database-per-tenant (Express + any SQL ORM, and Next + Prisma). Node.js >= 24 is required. With
--apply, init offers to also write a stack-specific TENANCY.md and register a TenancyJS block in an
existing AGENTS.md/CLAUDE.md; pass --ai-context to opt in non-interactively (it never creates an
agent-memory file that is not already there).

tenant and run commands load your tenancy.config.ts at runtime (Node 24 strips types natively) to reach
the TenantStore, manager, and provisioner you passed to defineTenancyRuntime. Pass --config to point at
a non-default config path. run executes a script inside a tenant scope (--tenant <id>) or the central
scope (--central). provision/deprovision/migrate delegate to your runtime's provisioner hooks (the CLI
never invokes an ORM itself); tenant check reports any adapter/strategy that is not tested-supported.

policy prints review-ready PostgreSQL forced-RLS DDL (ENABLE + FORCE ROW LEVEL SECURITY and a
<table>_tenant_isolation policy that reads tenancyjs.tenant_id and tenancyjs.is_central) for the tenant
tables you pass. It executes nothing and opens no connection - review the SQL and apply it with your own
migration tool. --tenant-column defaults to tenant_id; --out writes the SQL to a file.
`;
}
