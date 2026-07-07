import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createInitPlan, runCli } from "../src/index.js";
import type { CliIo } from "../src/index.js";
import { scaffoldableStrategies } from "../src/templates.js";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })),
  );
});
async function temporaryDirectory(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "tenancy-init-strategy-"));
  dirs.push(dir);
  return dir;
}
function captureIo(cwd: string) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const io: CliIo = {
    cwd,
    writeStdout: (v) => stdout.push(v),
    writeStderr: (v) => stderr.push(v),
  };
  return { stdout, stderr, io };
}
function contentOf(
  plan: Awaited<ReturnType<typeof createInitPlan>>,
  path: string,
) {
  return plan.actions.find((a) => a.path === path)?.content ?? "";
}
function interactiveIo(cwd: string, answers: readonly string[]) {
  const stdout: string[] = [];
  const questions: string[] = [];
  const queue = [...answers];
  const io: CliIo = {
    cwd,
    isInteractive: true,
    writeStdout: (v) => stdout.push(v),
    writeStderr: () => {},
    select: async (question) => {
      questions.push(question);
      return queue.shift() ?? "";
    },
  };
  return { stdout, questions, io };
}
async function projectDir(deps: Record<string, string>): Promise<string> {
  const dir = await temporaryDirectory();
  await writeFile(
    join(dir, "package.json"),
    JSON.stringify({ dependencies: deps }),
  );
  return dir;
}

describe("init interactive strategy prompt", () => {
  it("lists scaffoldable strategies per stack", () => {
    expect(scaffoldableStrategies("express", "sequelize")).toEqual([
      "rowLevel",
      "schemaPerTenant",
      "databasePerTenant",
    ]);
    // Next.js supports every SQL ORM (server code is Express architecture + React).
    expect(scaffoldableStrategies("next", "drizzle")).toEqual([
      "rowLevel",
      "schemaPerTenant",
      "databasePerTenant",
    ]);
    // Lucid supports all three strategies at runtime, so init scaffolds all three.
    expect(scaffoldableStrategies("adonis", "lucid")).toEqual([
      "rowLevel",
      "schemaPerTenant",
      "databasePerTenant",
    ]);
  });

  it("prompts for the ORM then a strategy when the stack has choices", async () => {
    const dir = await projectDir({ express: "5.2.0", sequelize: "6.37.0" });
    const io = interactiveIo(dir, ["sequelize", "databasePerTenant"]);
    expect(await runCli(["init"], io.io)).toBe(0);
    expect(io.questions).toContain("Which ORM are you using?");
    expect(io.questions).toContain("Which isolation strategy?");
  });

  it("prompts for a strategy on Adonis now that Lucid supports all three", async () => {
    const dir = await projectDir({
      "@adonisjs/core": "7.3.0",
      "@adonisjs/lucid": "22.4.0",
    });
    // Adonis has a single ORM (Lucid), so only the strategy is asked.
    const io = interactiveIo(dir, ["schemaPerTenant"]);
    await runCli(["init"], io.io);
    expect(io.questions).not.toContain("Which ORM are you using?");
    expect(io.questions).toContain("Which isolation strategy?");
  });

  it("does not prompt for a strategy when non-interactive", async () => {
    const dir = await projectDir({ express: "5.2.0", sequelize: "6.37.0" });
    const output = captureIo(dir); // no `select` → cannot prompt
    await runCli(["init"], output.io);
    expect(output.stdout.join("")).toContain("preview");
  });
});

describe("init --strategy scaffolds", () => {
  it("defaults to row-level with no strategy (unchanged)", async () => {
    const root = await temporaryDirectory();
    const plan = await createInitPlan({
      root,
      framework: "express",
      orm: "sequelize",
    });
    expect(plan.strategy).toBe("rowLevel");
    expect(contentOf(plan, "tenancy.config.ts")).toContain(
      'strategy: "rowLevel"',
    );
  });

  it("scaffolds database-per-tenant for express + sequelize with the real connection factory", async () => {
    const root = await temporaryDirectory();
    const plan = await createInitPlan({
      root,
      framework: "express",
      orm: "sequelize",
      strategy: "databasePerTenant",
    });
    expect(plan.strategy).toBe("databasePerTenant");
    expect(contentOf(plan, "tenancy.config.ts")).toContain(
      'strategy: "databasePerTenant"',
    );
    const register = contentOf(plan, "src/tenancy/register.ts");
    expect(register).toContain("createSequelizeTenancy");
    expect(register).toContain('strategy: "databasePerTenant"');
    expect(register).toContain("connection: (tenant) => ({");
    expect(register).toContain("key: tenant.id");
  });

  it("scaffolds schema-per-tenant with a schema factory", async () => {
    const root = await temporaryDirectory();
    const plan = await createInitPlan({
      root,
      framework: "express",
      orm: "typeorm",
      strategy: "schemaPerTenant",
    });
    const register = contentOf(plan, "src/tenancy/register.ts");
    expect(register).toContain("createTypeOrmTenancy");
    expect(register).toContain('strategy: "schemaPerTenant"');
    expect(register).toContain("schema: (tenant) =>");
  });

  it("scaffolds prisma with the strategy-specific factory (schema and database)", async () => {
    const root = await temporaryDirectory();
    const schema = await createInitPlan({
      root,
      framework: "next",
      orm: "prisma",
      strategy: "schemaPerTenant",
    });
    expect(contentOf(schema, "lib/tenancy/register.ts")).toContain(
      "createPrismaSchemaTenancy",
    );
    const database = await createInitPlan({
      root,
      framework: "express",
      orm: "prisma",
      strategy: "databasePerTenant",
    });
    expect(contentOf(database, "src/tenancy/register.ts")).toContain(
      "createPrismaDatabaseTenancy",
    );
  });

  it("scaffolds all three strategies for Adonis + Lucid using the real API", async () => {
    const root = await temporaryDirectory();
    const schema = await createInitPlan({
      root,
      framework: "adonis",
      orm: "lucid",
      strategy: "schemaPerTenant",
    });
    expect(schema.strategy).toBe("schemaPerTenant");
    const schemaConfig = contentOf(schema, "config/tenancy.ts");
    expect(schemaConfig).toContain('strategy: "schemaPerTenant"');
    expect(schemaConfig).toContain("schema: (tenant) =>");
    expect(schemaConfig).toContain("createLucidTenancy");

    const database = await createInitPlan({
      root,
      framework: "adonis",
      orm: "lucid",
      strategy: "databasePerTenant",
    });
    const databaseConfig = contentOf(database, "config/tenancy.ts");
    expect(databaseConfig).toContain('strategy: "databasePerTenant"');
    expect(databaseConfig).toContain("connection: (tenant) => ({");
    expect(databaseConfig).toContain("key: tenant.id");
  });

  it("fails closed for a combo it does not scaffold", async () => {
    const root = await temporaryDirectory();
    await expect(
      createInitPlan({
        root,
        framework: "express",
        orm: "lucid",
        strategy: "schemaPerTenant",
      }),
    ).rejects.toThrow(/does not scaffold .* for schemaPerTenant/);
  });

  it("rejects an unknown --strategy value", async () => {
    const output = captureIo(await temporaryDirectory());
    expect(await runCli(["init", "--strategy", "bogus"], output.io)).toBe(2);
    expect(output.stderr.join("")).toContain("Unknown strategy");
  });

  it("rejects --strategy outside init", async () => {
    const output = captureIo(await temporaryDirectory());
    expect(await runCli(["doctor", "--strategy", "row-level"], output.io)).toBe(
      2,
    );
    expect(output.stderr.join("")).toContain("valid only for init");
  });
});
