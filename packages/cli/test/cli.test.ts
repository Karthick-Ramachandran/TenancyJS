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
  applyChangePlan,
  createInitPlan,
  detectProject,
  redactText,
  runCli,
  runDoctor,
  runLeakTest,
} from "../src/index.js";
import { applyChangePlanWithHooks } from "../src/apply.js";
import type { ProjectChangePlan } from "../src/index.js";
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

    const plan = await createInitPlan(await detectProject(root));
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
    await expect(createInitPlan(detection)).rejects.toBeInstanceOf(
      CliProjectError,
    );
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
    const plan = await createInitPlan(await detectProject(root));

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
    const repeated = await createInitPlan(await detectProject(root));
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
    const plan = await createInitPlan(await detectProject(root));

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

    await expect(
      createInitPlan(await detectProject(root)),
    ).rejects.toBeInstanceOf(CliSecurityError);
    await expect(
      readFile(join(outside, "tenancy/register.ts"), "utf8"),
    ).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("rolls back every generated file and directory after an interrupted commit", async () => {
    const root = await fixture();
    const plan = await createInitPlan(await detectProject(root));

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
    const initial = await createInitPlan(await detectProject(root));
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
    await expect(
      createInitPlan(await detectProject(root)),
    ).rejects.toBeInstanceOf(CliSecurityError);
  });

  it("rolls back when another process creates a destination during commit", async () => {
    const root = await fixture();
    const plan = await createInitPlan(await detectProject(root));
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
    await applyChangePlan(await createInitPlan(await detectProject(root)));
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
        "UNSUPPORTED_EXPRESS_VERSION",
        "UNSUPPORTED_PRISMA_VERSION",
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
    await applyChangePlan(await createInitPlan(await detectProject(root)));
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
    expect(output.stderr.join("")).toContain("TENANCY_CLI_USAGE");

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
    const plan = await createInitPlan(await detectProject(root));
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
  await applyChangePlan(await createInitPlan(await detectProject(root)));
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

function captureIo(cwd: string) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    io: {
      cwd,
      writeStdout: (value: string) => stdout.push(value),
      writeStderr: (value: string) => stderr.push(value),
    },
  };
}
