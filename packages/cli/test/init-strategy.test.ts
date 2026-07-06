import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createInitPlan, runCli } from "../src/index.js";
import type { CliIo } from "../src/index.js";

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

  it("fails closed for a combo it does not scaffold yet", async () => {
    const root = await temporaryDirectory();
    await expect(
      createInitPlan({
        root,
        framework: "adonis",
        orm: "lucid",
        strategy: "databasePerTenant",
      }),
    ).rejects.toThrow(/does not scaffold .* for databasePerTenant yet/);
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
