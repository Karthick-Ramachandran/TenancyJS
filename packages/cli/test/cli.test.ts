import {
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  CliConflictError,
  CliProjectError,
  CliSecurityError,
  FRAMEWORK_CHOICES,
  applyChangePlan,
  capabilityBanner,
  checkNodeVersion,
  createInitPlan,
  detectProject,
  ormForFramework,
  parseNodeMajor,
  redactText,
  runCli,
  runDoctor,
  runLeakTest,
} from "../src/index.js";
import { applyChangePlanWithHooks } from "../src/apply.js";
import type {
  CliIo,
  InitFramework,
  InitOrm,
  ProjectChangePlan,
} from "../src/index.js";
import { appendBounded } from "../src/leak-test.js";
import {
  formatDoctor,
  formatJson,
  formatLeakTest,
  formatPlan,
} from "../src/output.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("CLI project detection and init", () => {
  it("detects only the tested Express and Prisma versions from package metadata", async () => {
    const root = await fixture();

    await expect(detectProject(root)).resolves.toMatchObject({
      root,
      framework: { name: "express", version: "5.2.1", supported: true },
      orm: { name: "prisma", version: "7.8.0", supported: true },
      supported: true,
    });

    await writeJson(join(root, "package.json"), {
      dependencies: { express: "4.21.0", "@prisma/client": "7.8.0" },
    });
    await expect(detectProject(root)).resolves.toMatchObject({
      framework: { name: "express", supported: false },
      supported: false,
    });
  });

  it("detects AdonisJS 7.3 with Lucid 22.4 and plans the Adonis templates", async () => {
    const root = await temporaryDirectory();
    await writeJson(join(root, "package.json"), {
      dependencies: { "@adonisjs/core": "7.3.4", "@adonisjs/lucid": "22.4.2" },
    });

    await expect(detectProject(root)).resolves.toMatchObject({
      framework: { name: "adonis", version: "7.3.4", supported: true },
      orm: { name: "lucid", version: "22.4.2", supported: true },
      supported: true,
    });

    const plan = await planFor(root);
    expect(plan).toMatchObject({
      framework: "adonis",
      orm: "lucid",
      strategy: "rowLevel",
    });
    expect(plan.actions.map((action) => action.path)).toEqual([
      "config/tenancy.ts",
      "app/middleware/tenant_middleware.ts",
    ]);
    expect(plan.actions.every((action) => action.status === "create")).toBe(
      true,
    );

    await writeJson(join(root, "package.json"), {
      dependencies: { "@adonisjs/core": "6.18.0", "@adonisjs/lucid": "22.4.2" },
    });
    await expect(detectProject(root)).resolves.toMatchObject({
      framework: { name: "adonis", supported: false },
      supported: false,
    });
  });

  it("fails safely for missing, malformed, and unsupported manifests", async () => {
    const missing = await temporaryDirectory();
    await expect(detectProject(missing)).rejects.toBeInstanceOf(
      CliProjectError,
    );

    await writeFile(join(missing, "package.json"), "not json");
    await expect(detectProject(missing)).rejects.toBeInstanceOf(
      CliProjectError,
    );

    await writeJson(join(missing, "package.json"), []);
    await expect(detectProject(missing)).rejects.toBeInstanceOf(
      CliProjectError,
    );

    await writeJson(join(missing, "package.json"), {
      dependencies: { lodash: "4.17.21" },
    });
    const detection = await detectProject(missing);
    expect(detection).toMatchObject({
      framework: { name: "unknown", supported: false },
      orm: { name: "unknown", supported: false },
      supported: false,
    });
    const output = captureIo(missing);
    await expect(runCli(["init"], output.io)).resolves.toBe(2);
    expect(output.stderr.join("")).toContain("--framework");
  });

  it("rejects a file or blank value as project root", async () => {
    const root = await temporaryDirectory();
    const file = join(root, "root.txt");
    await writeFile(file, "not a directory");
    await expect(detectProject(file)).rejects.toBeInstanceOf(CliProjectError);
    await expect(detectProject(" ")).rejects.toBeInstanceOf(CliProjectError);
  });

  it("previews, applies, and repeats an idempotent fixed plan", async () => {
    const root = await fixture();
    const plan = await planFor(root);

    expect(plan.actions.map(({ path, status }) => ({ path, status }))).toEqual([
      { path: "tenancy.config.ts", status: "create" },
      { path: "src/tenancy/register.ts", status: "create" },
      { path: "src/middleware/tenancy.ts", status: "create" },
    ]);
    await expect(
      readFile(join(root, "tenancy.config.ts"), "utf8"),
    ).rejects.toMatchObject({
      code: "ENOENT",
    });

    await expect(applyChangePlan(plan)).resolves.toEqual({
      created: [
        "tenancy.config.ts",
        "src/tenancy/register.ts",
        "src/middleware/tenancy.ts",
      ],
      unchanged: [],
    });
    const repeated = await planFor(root);
    expect(repeated.actions.every(({ status }) => status === "unchanged")).toBe(
      true,
    );
    await expect(applyChangePlan(repeated)).resolves.toEqual({
      created: [],
      unchanged: [
        "tenancy.config.ts",
        "src/tenancy/register.ts",
        "src/middleware/tenancy.ts",
      ],
    });
  });

  it("reports conflicts without overwriting user files", async () => {
    const root = await fixture();
    await writeFile(join(root, "tenancy.config.ts"), "// user owned\n");
    const plan = await planFor(root);

    expect(plan.actions[0]).toMatchObject({ status: "conflict" });
    await expect(applyChangePlan(plan)).rejects.toBeInstanceOf(
      CliConflictError,
    );
    await expect(
      readFile(join(root, "tenancy.config.ts"), "utf8"),
    ).resolves.toBe("// user owned\n");
    await expect(
      readFile(join(root, "src/tenancy/register.ts"), "utf8"),
    ).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it.each(["../escape.ts", "/tmp/escape.ts", "src/../../escape.ts"])(
    "rejects malicious plan path %s",
    async (path) => {
      const root = await fixture();
      const plan = maliciousPlan(root, path);
      await expect(applyChangePlan(plan)).rejects.toBeInstanceOf(
        CliSecurityError,
      );
    },
  );

  it("rejects symlink parents and never writes through them", async () => {
    const root = await fixture();
    const outside = await temporaryDirectory();
    await symlink(outside, join(root, "src"));

    await expect(planFor(root)).rejects.toBeInstanceOf(CliSecurityError);
    await expect(
      readFile(join(outside, "tenancy/register.ts"), "utf8"),
    ).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("rolls back every generated file and directory after an interrupted commit", async () => {
    const root = await fixture();
    const plan = await planFor(root);

    await expect(
      applyChangePlanWithHooks(plan, {
        beforeCommit(_action, index) {
          if (index === 2) throw new Error("simulated interruption");
        },
      }),
    ).rejects.toMatchObject({ code: "TENANCY_CLI_APPLY" });

    for (const action of plan.actions) {
      await expect(
        readFile(join(root, action.path), "utf8"),
      ).rejects.toMatchObject({
        code: "ENOENT",
      });
    }
  });

  it("rejects stale, duplicate, non-canonical, and raced plans", async () => {
    const root = await fixture();
    const initial = await planFor(root);
    const nonCanonical = { ...initial, root: `${root}/.` };
    await expect(applyChangePlan(nonCanonical)).rejects.toBeInstanceOf(
      CliSecurityError,
    );

    const duplicate = {
      ...initial,
      actions: [initial.actions[0]!, initial.actions[0]!],
    };
    await expect(applyChangePlan(duplicate)).rejects.toBeInstanceOf(
      CliSecurityError,
    );

    await writeFile(join(root, "tenancy.config.ts"), "raced content");
    await expect(applyChangePlan(initial)).rejects.toBeInstanceOf(
      CliConflictError,
    );
  });

  it("detects a file where a generated parent directory is required", async () => {
    const root = await fixture();
    await writeFile(join(root, "src"), "not a directory");
    await expect(planFor(root)).rejects.toBeInstanceOf(CliSecurityError);
  });

  it("rolls back when another process creates a destination during commit", async () => {
    const root = await fixture();
    const plan = await planFor(root);
    await expect(
      applyChangePlanWithHooks(plan, {
        async beforeCommit(action, index) {
          if (index === 0)
            await writeFile(join(root, action.path), "concurrent owner");
        },
      }),
    ).rejects.toBeInstanceOf(CliConflictError);
    await expect(
      readFile(join(root, "tenancy.config.ts"), "utf8"),
    ).resolves.toBe("concurrent owner");
  });
});

describe("CLI doctor", () => {
  it("inventories wiring, unsafe Prisma surfaces, classification, and migration effort", async () => {
    const root = await fixture();
    await applyChangePlan(await planFor(root));
    await mkdir(join(root, "test"));
    await writeFile(
      join(root, "test/tenancy.leak.test.mjs"),
      "process.exit(0);\n",
    );
    await writeFile(
      join(root, "src/repository.ts"),
      `const prisma = new PrismaClient();
await prisma.$queryRaw\`select * from secrets\`;
await prisma.post.findMany({ include: { comments: true } });
`,
    );
    await writeFile(
      join(root, ".env"),
      "DATABASE_URL=postgresql://secret:password@host/db\n",
    );

    const report = await runDoctor(root);

    expect(report.status).toBe("errors");
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "UNEXTENDED_PRISMA_CLIENT",
          severity: "error",
        }),
        expect.objectContaining({
          code: "UNSAFE_RAW_PRISMA",
          severity: "error",
        }),
        expect.objectContaining({
          code: "RELATION_OPERATION_REVIEW",
          severity: "warning",
        }),
        expect.objectContaining({
          code: "INCOMPLETE_MODEL_CLASSIFICATION",
          severity: "error",
        }),
      ]),
    );
    expect(report.migrationEffort.level).not.toBe("low");
    expect(JSON.stringify(report)).not.toContain("password");
  });

  it("reports a warning-only reviewed project with stable JSON shape", async () => {
    const root = await healthyFixture();
    const report = await runDoctor(root);

    expect(report).toMatchObject({
      schemaVersion: 1,
      command: "doctor",
      status: "warnings",
      summary: { errors: 0, warnings: 1 },
      migrationEffort: { level: "low" },
    });
    expect(report.findings).toEqual([
      expect.objectContaining({
        code: "MANUAL_MODEL_CLASSIFICATION",
        severity: "warning",
      }),
    ]);
  });

  it("reports unsupported versions, missing wiring, schema, and leak evidence", async () => {
    const root = await temporaryDirectory();
    await writeJson(join(root, "package.json"), {
      dependencies: { express: "4.21.0", "@prisma/client": "6.0.0" },
    });

    const report = await runDoctor(root, { testFile: "missing.mjs" });

    expect(report.status).toBe("errors");
    expect(report.findings.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "UNSUPPORTED_FRAMEWORK_VERSION",
        "UNSUPPORTED_ORM_VERSION",
        "MISSING_WIRING",
        "INVALID_LEAK_TEST",
      ]),
    );
  });

  it("reports protected base-client, nested-operation, symlink, and large-file review", async () => {
    const root = await healthyFixture();
    await writeFile(
      join(root, "src/protected.ts"),
      `const base = new PrismaClient();
const prisma = base.$extends(createPrismaTenancyExtension({}));
await prisma.post.create({ data: { comments: { create: { body: "x" } } } });
`,
    );
    const outside = await temporaryDirectory();
    await writeFile(join(outside, "external.ts"), "export {};\n");
    await symlink(join(outside, "external.ts"), join(root, "src/external.ts"));
    await writeFile(join(root, "src/large.ts"), "x".repeat(1_000_001));

    const report = await runDoctor(root);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "BASE_CLIENT_REVIEW" }),
        expect.objectContaining({ code: "NESTED_OPERATION_REVIEW" }),
        expect.objectContaining({ code: "SOURCE_SYMLINK_SKIPPED" }),
        expect.objectContaining({ code: "LARGE_SOURCE_SKIPPED" }),
      ]),
    );
  });

  it("reports missing classification fields and missing Prisma schema", async () => {
    const root = await fixture();
    await applyChangePlan(await planFor(root));
    await writeFile(
      join(root, "src/tenancy/register.ts"),
      "export const config = {};\n",
    );
    await rm(join(root, "prisma/schema.prisma"));

    const report = await runDoctor(root);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "INCOMPLETE_MODEL_CLASSIFICATION" }),
        expect.objectContaining({ code: "MISSING_LEAK_TEST" }),
      ]),
    );
  });

  it("redacts URL credentials and secret assignments", () => {
    const value = redactText(
      "postgresql://admin:password@localhost/db DATABASE_URL=postgresql://other:secret@host/db token=abc",
    );
    expect(value).not.toContain("password");
    expect(value).not.toContain("secret");
    expect(value).not.toContain("abc");
    expect(value).toContain("[REDACTED]");
  });
});

describe("CLI leak test and command runner", () => {
  it("runs only an explicit contained JavaScript file and redacts its output", async () => {
    const root = await fixture();
    await mkdir(join(root, "test"));
    await writeFile(
      join(root, "test/pass.mjs"),
      'if (process.env.UNRELATED_SECRET) process.exit(3); console.log("postgresql://admin:password@localhost/db");\n',
    );
    await writeFile(
      join(root, "test/fail.mjs"),
      'console.error("leak found"); process.exit(7);\n',
    );

    process.env.UNRELATED_SECRET = "must-not-reach-child";
    try {
      await expect(runLeakTest(root, "test/pass.mjs")).resolves.toMatchObject({
        status: "passed",
        exitCode: 0,
        stdout: expect.not.stringContaining("password"),
      });
    } finally {
      delete process.env.UNRELATED_SECRET;
    }
    await expect(runLeakTest(root, "test/fail.mjs")).resolves.toMatchObject({
      status: "failed",
      exitCode: 7,
      stderr: "leak found\n",
    });
    await expect(runLeakTest(root, "../outside.mjs")).rejects.toBeInstanceOf(
      CliSecurityError,
    );
    await writeFile(join(root, "test/not-js.ts"), "process.exit(0);\n");
    await expect(runLeakTest(root, "test/not-js.ts")).rejects.toBeInstanceOf(
      CliSecurityError,
    );

    await expect(runLeakTest(root, "test/missing.mjs")).rejects.toBeInstanceOf(
      CliProjectError,
    );
    await symlink(join(root, "test/pass.mjs"), join(root, "test/link.mjs"));
    await expect(runLeakTest(root, "test/link.mjs")).rejects.toBeInstanceOf(
      CliSecurityError,
    );

    await writeFile(
      join(root, "test/slow.mjs"),
      "setInterval(() => {}, 1000);\n",
    );
    await expect(
      runLeakTest(root, "test/slow.mjs", { timeoutMs: 20 }),
    ).resolves.toMatchObject({
      status: "failed",
      exitCode: 2,
      stderr: expect.stringContaining("exceeded 20ms"),
    });
    let exceeded = false;
    const bounded = appendBounded("x".repeat(999_999), "yyyy", () => {
      exceeded = true;
    });
    expect(bounded).toHaveLength(1_000_000);
    expect(exceeded).toBe(true);
    await expect(
      runLeakTest(root, "test/pass.mjs", { timeoutMs: 0 }),
    ).rejects.toBeInstanceOf(CliProjectError);
  });

  it("emits deterministic JSON and binary-style exit codes", async () => {
    const root = await healthyFixture();
    const output = captureIo(root);

    await expect(runCli(["doctor", "--json"], output.io)).resolves.toBe(1);
    const report = JSON.parse(output.stdout.join(""));
    expect(report).toMatchObject({
      schemaVersion: 1,
      command: "doctor",
      status: "warnings",
    });

    output.stdout.length = 0;
    await expect(
      runCli(
        ["test:leak", "--test-file", "test/tenancy.leak.test.mjs", "--json"],
        output.io,
      ),
    ).resolves.toBe(0);
    expect(JSON.parse(output.stdout.join(""))).toMatchObject({
      schemaVersion: 1,
      command: "test:leak",
      status: "passed",
    });
  });

  it("covers human output, init apply, failures, help, and argument validation", async () => {
    const root = await fixture();
    const output = captureIo(root);

    await expect(runCli(["help"], output.io)).resolves.toBe(0);
    expect(output.stdout.join("")).toContain("Usage:");

    output.stdout.length = 0;
    await expect(runCli(["init"], output.io)).resolves.toBe(0);
    expect(output.stdout.join("")).toContain("preview");

    output.stdout.length = 0;
    await expect(runCli(["init", "--apply"], output.io)).resolves.toBe(0);
    expect(output.stdout.join("")).toContain("applied");

    await expect(runCli(["doctor", "--apply"], output.io)).resolves.toBe(2);
    await expect(runCli(["test:leak"], output.io)).resolves.toBe(2);
    await expect(runCli(["doctor", "--root"], output.io)).resolves.toBe(2);
    await expect(runCli(["doctor", "--unknown"], output.io)).resolves.toBe(2);
    await expect(runCli(["unknown"], output.io)).resolves.toBe(2);
    expect(output.stderr.join("")).toContain("Unknown command: unknown");

    output.stderr.length = 0;
    await expect(runCli(["unknown", "--json"], output.io)).resolves.toBe(2);
    expect(JSON.parse(output.stderr.join(""))).toMatchObject({
      schemaVersion: 1,
      status: "error",
      error: { code: "TENANCY_CLI_USAGE" },
    });
  });

  it("formats every public output without exposing plan contents", async () => {
    const root = await healthyFixture();
    const plan = await planFor(root);
    const doctor = await runDoctor(root);
    const leak = await runLeakTest(root, "test/tenancy.leak.test.mjs");

    expect(formatPlan(plan, false)).toContain("preview");
    expect(formatPlan(plan, true)).toContain("applied");
    expect(formatDoctor(doctor)).toContain("Migration effort");
    expect(formatLeakTest(leak)).toContain("PASSED");
    expect(formatJson({ password: "not-a-secret-output-contract" })).toContain(
      "not-a-secret-output-contract",
    );
    expect(formatPlan(plan, false)).not.toContain(plan.actions[0]!.content);
  });

  it("writes an opt-in AI context file and registers a block in agent memory", async () => {
    const root = await fixture();
    await writeFile(join(root, "AGENTS.md"), "# App\n\nExisting notes.\n");
    const output = captureIo(root);

    await expect(
      runCli(["init", "--apply", "--ai-context"], output.io),
    ).resolves.toBe(0);

    const guide = await readFile(join(root, "TENANCY.md"), "utf8");
    expect(guide).toContain("Working with TenancyJS — Express + Prisma");
    expect(guide).toContain("npx tenancyjs-cli tenant provision");
    const agents = await readFile(join(root, "AGENTS.md"), "utf8");
    expect(agents).toContain("Existing notes.");
    expect(agents).toContain("## TenancyJS");
    expect(agents.match(/tenancyjs:start/gu)).toHaveLength(1);
    expect(output.stdout.join("")).toContain("Wrote");

    // Re-running is idempotent: no duplicate block, guide reported unchanged.
    output.stdout.length = 0;
    await expect(
      runCli(["init", "--apply", "--ai-context"], output.io),
    ).resolves.toBe(0);
    const agentsAgain = await readFile(join(root, "AGENTS.md"), "utf8");
    expect(agentsAgain.match(/tenancyjs:start/gu)).toHaveLength(1);
    expect(output.stdout.join("")).toContain("already current");
  });

  it("tailors the AI context isolation model to the scaffolded strategy", async () => {
    const schemaRoot = await fixture();
    const schemaIo = captureIo(schemaRoot);
    await expect(
      runCli(
        ["init", "--apply", "--strategy", "schema-per-tenant", "--ai-context"],
        schemaIo.io,
      ),
    ).resolves.toBe(0);
    const schemaGuide = await readFile(join(schemaRoot, "TENANCY.md"), "utf8");
    expect(schemaGuide).toContain("schema-per-tenant");
    expect(schemaGuide).toContain("search_path");
    expect(schemaGuide).not.toContain("forced PostgreSQL RLS");
    // The resolve-vs-authorize guidance is always present.
    expect(schemaGuide).toContain("Resolving the tenant per request");
    expect(schemaGuide).toContain("Resolving is not authorizing");

    const dbRoot = await fixture();
    const dbIo = captureIo(dbRoot);
    await expect(
      runCli(
        [
          "init",
          "--apply",
          "--strategy",
          "database-per-tenant",
          "--ai-context",
        ],
        dbIo.io,
      ),
    ).resolves.toBe(0);
    const dbGuide = await readFile(join(dbRoot, "TENANCY.md"), "utf8");
    expect(dbGuide).toContain("database-per-tenant");
    expect(dbGuide).toContain("isolation is by construction");
    expect(dbGuide).not.toContain("forced PostgreSQL RLS");
  });

  it("does not write AI context without opt-in, and hints when no agent memory exists", async () => {
    const withoutFlag = await fixture();
    const first = captureIo(withoutFlag);
    await expect(runCli(["init", "--apply"], first.io)).resolves.toBe(0);
    await expect(
      readFile(join(withoutFlag, "TENANCY.md"), "utf8"),
    ).rejects.toThrow();

    const noMemory = await fixture();
    const second = captureIo(noMemory);
    await expect(
      runCli(["init", "--apply", "--ai-context"], second.io),
    ).resolves.toBe(0);
    await expect(
      readFile(join(noMemory, "TENANCY.md"), "utf8"),
    ).resolves.toContain("TenancyJS");
    await expect(
      readFile(join(noMemory, "AGENTS.md"), "utf8"),
    ).rejects.toThrow();
    expect(second.stdout.join("")).toContain("No AGENTS.md or CLAUDE.md found");
  });

  it("prompts for AI context interactively and honors the answer", async () => {
    const yesRoot = await fixture();
    // Interactive init (Express) prompts for the ORM, then the strategy, then AI context.
    const yes = captureIo(yesRoot, {
      isInteractive: true,
      answers: ["prisma", "rowLevel", "yes"],
    });
    await expect(runCli(["init", "--apply"], yes.io)).resolves.toBe(0);
    expect(yes.selectQuestions).toHaveLength(3);
    expect(yes.selectQuestions[0]!.question).toContain("ORM");
    expect(yes.selectQuestions[1]!.question).toContain("isolation strategy");
    expect(yes.selectQuestions[2]!.question).toContain("TENANCY.md");
    await expect(
      readFile(join(yesRoot, "TENANCY.md"), "utf8"),
    ).resolves.toContain("TenancyJS");

    const noRoot = await fixture();
    const no = captureIo(noRoot, {
      isInteractive: true,
      answers: ["prisma", "rowLevel", "no"],
    });
    await expect(runCli(["init", "--apply"], no.io)).resolves.toBe(0);
    await expect(
      readFile(join(noRoot, "TENANCY.md"), "utf8"),
    ).rejects.toThrow();
  });

  it("exposes AI context in --json output and rejects the flag off init", async () => {
    const root = await fixture();
    await writeFile(join(root, "CLAUDE.md"), "# Claude\n");
    const output = captureIo(root);
    await expect(
      runCli(["init", "--apply", "--ai-context", "--json"], output.io),
    ).resolves.toBe(0);
    expect(JSON.parse(output.stdout.join(""))).toMatchObject({
      aiContext: { guide: "created", memory: [{ path: "CLAUDE.md" }] },
    });

    await expect(runCli(["doctor", "--ai-context"], output.io)).resolves.toBe(
      2,
    );
  });
});

async function fixture(): Promise<string> {
  const root = await temporaryDirectory();
  await writeJson(join(root, "package.json"), {
    dependencies: { express: "5.2.1", "@prisma/client": "7.8.0" },
  });
  await mkdir(join(root, "prisma"));
  await writeFile(
    join(root, "prisma/schema.prisma"),
    `model Tenant {
  id String @id
}

model Post {
  id String @id
  tenantId String
}
`,
  );
  return root;
}

async function healthyFixture(): Promise<string> {
  const root = await fixture();
  await applyChangePlan(await planFor(root));
  await writeFile(
    join(root, "src/tenancy/register.ts"),
    `export const config = {
  tenantModels: { Post: {} },
  centralModels: { Tenant: {} },
};
`,
  );
  await mkdir(join(root, "test"));
  await writeFile(
    join(root, "test/tenancy.leak.test.mjs"),
    "process.exit(0);\n",
  );
  return root;
}

async function temporaryDirectory(): Promise<string> {
  const path = await realpath(await mkdtemp(join(tmpdir(), "tenancyjs-cli-")));
  temporaryDirectories.push(path);
  return path;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function maliciousPlan(root: string, path: string): ProjectChangePlan {
  return {
    schemaVersion: 1,
    root,
    framework: "express",
    orm: "prisma",
    strategy: "rowLevel",
    actions: [{ path, content: "unsafe", status: "create" }],
  };
}

interface CaptureOptions {
  readonly nodeVersion?: string;
  readonly isInteractive?: boolean;
  readonly answers?: readonly string[];
}

function captureIo(cwd: string, options: CaptureOptions = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const selectQuestions: {
    question: string;
    choices: readonly { value: string; label: string }[];
  }[] = [];
  const queue = options.answers === undefined ? [] : [...options.answers];
  const io: CliIo = {
    cwd,
    writeStdout: (value: string) => stdout.push(value),
    writeStderr: (value: string) => stderr.push(value),
    ...(options.nodeVersion === undefined
      ? {}
      : { nodeVersion: options.nodeVersion }),
    ...(options.isInteractive ? { isInteractive: true } : {}),
    ...(options.answers === undefined
      ? {}
      : {
          select: async (
            question: string,
            choices: readonly { value: string; label: string }[],
          ) => {
            selectQuestions.push({ question, choices });
            return queue.shift() ?? "";
          },
        }),
  };
  return { stdout, stderr, selectQuestions, io };
}

async function planFor(root: string) {
  const detection = await detectProject(root);
  return createInitPlan({
    root: detection.root,
    framework: detection.framework.name as InitFramework,
    orm: detection.orm.name as InitOrm,
  });
}

describe("CLI v0.1 interactive init", () => {
  it.each([
    ["typeorm", "1.0.0", "createTypeOrmTenancy"],
    ["sequelize", "6.37.8", "createSequelizeTenancy"],
    ["drizzle-orm", "0.45.2", "createDrizzleTenancy"],
  ])(
    "detects and scaffolds Express with %s",
    async (dependency, version, factory) => {
      const root = await temporaryDirectory();
      await writeJson(join(root, "package.json"), {
        dependencies: { express: "5.2.1", [dependency]: version },
      });
      const detection = await detectProject(root);
      expect(detection.supported).toBe(true);
      const plan = await createInitPlan({
        root: detection.root,
        framework: "express",
        orm: detection.orm.name as InitOrm,
      });
      expect(
        plan.actions.find((action) => action.path === "src/tenancy/register.ts")
          ?.content,
      ).toContain(factory);
    },
  );

  it("supports explicit Express Drizzle init in non-interactive CI", async () => {
    const root = await temporaryDirectory();
    await writeJson(join(root, "package.json"), {
      dependencies: { express: "5.2.1" },
    });
    const output = captureIo(root);
    await expect(
      runCli(
        ["init", "--framework", "express", "--orm", "drizzle", "--json"],
        output.io,
      ),
    ).resolves.toBe(0);
    expect(JSON.parse(output.stdout.join(""))).toMatchObject({
      framework: "express",
      orm: "drizzle",
    });
  });

  it("does not silently choose between multiple installed ORMs", async () => {
    const root = await temporaryDirectory();
    await writeJson(join(root, "package.json"), {
      dependencies: {
        express: "5.2.1",
        typeorm: "1.0.0",
        "drizzle-orm": "0.45.2",
      },
    });
    await expect(detectProject(root)).resolves.toMatchObject({
      orm: { name: "unknown", supported: false },
      supported: false,
    });
    const output = captureIo(root);
    await expect(runCli(["init"], output.io)).resolves.toBe(2);
    expect(output.stderr.join("")).toContain("Pass --orm");
  });

  it("exposes capability metadata and a Node version gate", () => {
    expect(FRAMEWORK_CHOICES.map((choice) => choice.value)).toEqual([
      "express",
      "adonis",
      "next",
    ]);
    expect(ormForFramework("adonis")).toBe("lucid");
    expect(ormForFramework("express")).toBe("prisma");
    expect(ormForFramework("next")).toBe("prisma");
    expect(parseNodeMajor("v24.13.2")).toBe(24);
    expect(parseNodeMajor("not-a-version")).toBe(0);
    expect(checkNodeVersion("24.0.0")).toMatchObject({
      ok: true,
      requiredMajor: 24,
    });
    expect(checkNodeVersion("20.11.0").ok).toBe(false);
    const banner = capabilityBanner("24.0.0");
    expect(banner).toContain("Express");
    expect(banner).toContain("Next.js");
    expect(banner).toContain("Prisma");
    expect(banner).toContain("row-level");
    expect(banner).toContain("database-per-tenant");
    expect(banner).toContain("Node 24+");
  });

  it("detects Next.js 16 + Prisma and plans the Next templates", async () => {
    const root = await temporaryDirectory();
    await writeJson(join(root, "package.json"), {
      dependencies: {
        next: "16.2.10",
        react: "19.2.7",
        "@prisma/client": "7.8.0",
      },
    });
    await expect(detectProject(root)).resolves.toMatchObject({
      framework: { name: "next", version: "16.2.10", supported: true },
      orm: { name: "prisma", supported: true },
      supported: true,
    });
    const plan = await planFor(root);
    expect(plan).toMatchObject({
      framework: "next",
      orm: "prisma",
      strategy: "rowLevel",
    });
    expect(plan.actions.map((action) => action.path)).toEqual([
      "tenancy.config.ts",
      "lib/tenancy/register.ts",
      "lib/tenancy/server.ts",
    ]);
  });

  it("prints the capability banner and refuses Node below 24 without writing files", async () => {
    const root = await fixture();
    const output = captureIo(root, { nodeVersion: "20.11.0" });
    await expect(runCli(["init"], output.io)).resolves.toBe(2);
    expect(output.stderr.join("")).toContain("Stacks");
    expect(output.stderr.join("")).toContain("Node 24+");
    await expect(
      readFile(join(root, "tenancy.config.ts"), "utf8"),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("asks for the framework when it cannot be detected and uses the choice", async () => {
    const root = await temporaryDirectory();
    await writeJson(join(root, "package.json"), {
      dependencies: { lodash: "4.17.21", "@prisma/client": "7.8.0" },
    });
    const output = captureIo(root, {
      isInteractive: true,
      answers: ["next", "prisma", "rowLevel", "no"],
    });
    await expect(runCli(["init", "--apply"], output.io)).resolves.toBe(0);
    // Framework prompt, then ORM (Next now supports several), strategy, AI context.
    expect(output.selectQuestions).toHaveLength(4);
    expect(
      output.selectQuestions[0]!.choices.map((choice) => choice.value),
    ).toEqual(["express", "adonis", "next"]);
    expect(output.selectQuestions[1]!.question).toContain("ORM");
    expect(output.selectQuestions[2]!.question).toContain("isolation strategy");
    expect(output.stderr.join("")).toContain("No supported framework");
    await expect(
      readFile(join(root, "lib/tenancy/server.ts"), "utf8"),
    ).resolves.toContain("createNextTenancy");
  });

  it("explains an unsupported detected version before prompting, and derives Lucid for Adonis", async () => {
    const root = await temporaryDirectory();
    await writeJson(join(root, "package.json"), {
      dependencies: { "@adonisjs/core": "6.18.0" },
    });
    const output = captureIo(root, {
      isInteractive: true,
      answers: ["adonis"],
    });
    await expect(runCli(["init", "--apply"], output.io)).resolves.toBe(0);
    expect(output.stderr.join("")).toContain("outside the supported range");
    await expect(
      readFile(join(root, "config/tenancy.ts"), "utf8"),
    ).resolves.toContain("createLucidTenancy");
  });

  it("rejects an invalid interactive choice", async () => {
    const root = await temporaryDirectory();
    await writeJson(join(root, "package.json"), {
      dependencies: { lodash: "4.17.21" },
    });
    const output = captureIo(root, {
      isInteractive: true,
      answers: ["banana"],
    });
    await expect(runCli(["init"], output.io)).resolves.toBe(2);
    expect(output.stderr.join("")).toContain('Unknown framework "banana"');
  });

  it("does not prompt when --yes is set even on a TTY", async () => {
    const root = await temporaryDirectory();
    await writeJson(join(root, "package.json"), {
      dependencies: { lodash: "4.17.21" },
    });
    const output = captureIo(root, { isInteractive: true, answers: ["next"] });
    await expect(runCli(["init", "--yes"], output.io)).resolves.toBe(2);
    expect(output.selectQuestions).toHaveLength(0);
    expect(output.stderr.join("")).toContain("--framework");
  });

  it("honors --framework as a non-interactive escape hatch", async () => {
    const root = await fixture();
    const output = captureIo(root);
    await expect(
      runCli(["init", "--framework", "next", "--json"], output.io),
    ).resolves.toBe(0);
    expect(JSON.parse(output.stdout.join(""))).toMatchObject({
      framework: "next",
      orm: "prisma",
      mode: "dry-run",
    });
  });

  it("validates --framework values and init-only flags", async () => {
    const output = captureIo(await temporaryDirectory());
    await expect(runCli(["init", "--framework"], output.io)).resolves.toBe(2);
    await expect(
      runCli(["init", "--framework", "django"], output.io),
    ).resolves.toBe(2);
    expect(output.stderr.join("")).toContain('Unknown framework "django"');
    await expect(
      runCli(["doctor", "--framework", "next"], output.io),
    ).resolves.toBe(2);
    await expect(runCli(["doctor", "--yes"], output.io)).resolves.toBe(2);
  });
});
