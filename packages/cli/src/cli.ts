import { applyChangePlan } from "./apply.js";
import { detectProject } from "./detection.js";
import { CliUsageError, TenancyCliError } from "./errors.js";
import { runDoctor } from "./doctor.js";
import { runLeakTest } from "./leak-test.js";
import {
  formatDoctor,
  formatJson,
  formatLeakTest,
  formatPlan,
} from "./output.js";
import { createInitPlan } from "./plan.js";
import { redactText } from "./redaction.js";

export interface CliIo {
  readonly cwd: string;
  writeStdout(value: string): void;
  writeStderr(value: string): void;
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
      const plan = await createInitPlan(await detectProject(root));
      if (parsed.apply) await applyChangePlan(plan);
      io.writeStdout(
        parsed.json
          ? formatJson(publicPlan(plan, parsed.apply))
          : formatPlan(plan, parsed.apply),
      );
      return plan.actions.some(({ status }) => status === "conflict") ? 2 : 0;
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
        : `${code}: ${redacted}\n`,
    );
    return 2;
  }
}

interface ParsedArguments {
  readonly command: "init" | "doctor" | "test:leak" | "help";
  readonly root?: string;
  readonly testFile?: string;
  readonly apply: boolean;
  readonly json: boolean;
}

function parseArguments(arguments_: readonly string[]): ParsedArguments {
  const commandValue = arguments_[0] ?? "help";
  if (
    commandValue === "--help" ||
    commandValue === "-h" ||
    commandValue === "help"
  ) {
    return { command: "help", apply: false, json: false };
  }
  if (
    commandValue !== "init" &&
    commandValue !== "doctor" &&
    commandValue !== "test:leak"
  ) {
    throw new CliUsageError(`Unknown command: ${commandValue}`);
  }
  let root: string | undefined;
  let testFile: string | undefined;
  let apply = false;
  let json = false;
  for (let index = 1; index < arguments_.length; index += 1) {
    const argument = arguments_[index]!;
    if (argument === "--apply") apply = true;
    else if (argument === "--json") json = true;
    else if (argument === "--root" || argument === "--test-file") {
      const value = arguments_[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new CliUsageError(`${argument} requires a value.`);
      }
      if (argument === "--root") root = value;
      else testFile = value;
      index += 1;
    } else {
      throw new CliUsageError(`Unknown option: ${argument}`);
    }
  }
  if (commandValue !== "init" && apply)
    throw new CliUsageError("--apply is valid only for init.");
  return {
    command: commandValue,
    ...(root === undefined ? {} : { root }),
    ...(testFile === undefined ? {} : { testFile }),
    apply,
    json,
  };
}

function publicPlan(
  plan: Awaited<ReturnType<typeof createInitPlan>>,
  applied: boolean,
) {
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
  tenancy init [--root <path>] [--apply] [--json]
  tenancy doctor [--root <path>] [--test-file <path>] [--json]
  tenancy test:leak --test-file <path> [--root <path>] [--json]

init is a dry run unless --apply is present. The initial CLI supports Express 5.2 + Prisma 7.8.
`;
}
