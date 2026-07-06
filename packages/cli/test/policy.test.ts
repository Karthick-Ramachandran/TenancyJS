import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runCli } from "../src/index.js";
import type { CliIo } from "../src/index.js";
import { generatePolicySql, runPolicy } from "../src/commands/policy.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function temporaryDirectory(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "tenancy-policy-"));
  temporaryDirectories.push(dir);
  return dir;
}

function captureIo(cwd: string) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const io: CliIo = {
    cwd,
    writeStdout: (value) => stdout.push(value),
    writeStderr: (value) => stderr.push(value),
  };
  return { stdout, stderr, io };
}

describe("policy SQL generator", () => {
  it("emits forced RLS DDL that satisfies the startup validator contract", () => {
    const sql = generatePolicySql({ tables: ["posts"], role: "app_runtime" });

    // ENABLE + FORCE on the table.
    expect(sql).toContain("ALTER TABLE posts ENABLE ROW LEVEL SECURITY;");
    expect(sql).toContain("ALTER TABLE posts FORCE ROW LEVEL SECURITY;");
    // The <table>_tenant_isolation policy convention.
    expect(sql).toContain("CREATE POLICY posts_tenant_isolation ON posts");
    // Lockstep with validatePostgresRlsPolicies: both GUCs must appear in both
    // USING and WITH CHECK, so each setting occurs at least twice.
    expect(
      sql.match(/tenancyjs\.tenant_id/g)?.length ?? 0,
    ).toBeGreaterThanOrEqual(2);
    expect(
      sql.match(/tenancyjs\.is_central/g)?.length ?? 0,
    ).toBeGreaterThanOrEqual(2);
    expect(sql).toContain("WITH CHECK (");
    // Least privilege.
    expect(sql).toContain("REVOKE ALL ON posts FROM PUBLIC;");
    expect(sql).toContain(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON posts TO app_runtime;",
    );
    // It documents that it executes nothing.
    expect(sql).toContain("TenancyJS never executes this");
  });

  it("honors a custom tenant column and multiple tables", () => {
    const sql = generatePolicySql({
      tables: ["public.posts", "comments"],
      role: "runtime",
      tenantColumn: "org_id",
    });
    expect(sql).toContain(
      "CREATE POLICY posts_tenant_isolation ON public.posts",
    );
    expect(sql).toContain(
      "CREATE POLICY comments_tenant_isolation ON comments",
    );
    expect(sql).toContain(
      "OR org_id = current_setting('tenancyjs.tenant_id', true)",
    );
    expect(sql).not.toContain("tenant_id = current_setting");
  });

  it("refuses non-identifier table, role, or column (no injection)", () => {
    expect(() =>
      generatePolicySql({ tables: ["posts; drop table users"], role: "r" }),
    ).toThrow(/plain SQL identifier/);
    expect(() =>
      generatePolicySql({ tables: ["posts"], role: "r; grant" }),
    ).toThrow(/plain SQL identifier/);
    expect(() =>
      generatePolicySql({
        tables: ["posts"],
        role: "r",
        tenantColumn: "a b",
      }),
    ).toThrow(/plain SQL identifier/);
  });

  it("requires at least one table", () => {
    expect(() => generatePolicySql({ tables: [], role: "r" })).toThrow(
      /at least one --table/,
    );
  });

  it("runPolicy writes to --out when given, relative to root", async () => {
    const root = await temporaryDirectory();
    const result = runPolicy({
      tables: ["posts"],
      role: "app_runtime",
      out: "rls.sql",
      json: false,
      root,
    });
    expect(result.writtenTo).toBe(join(root, "rls.sql"));
    await expect(readFile(join(root, "rls.sql"), "utf8")).resolves.toContain(
      "FORCE ROW LEVEL SECURITY",
    );
  });
});

describe("policy command via runCli", () => {
  it("prints SQL and exits 0", async () => {
    const output = captureIo(await temporaryDirectory());
    const code = await runCli(
      ["policy", "--table", "posts", "--role", "app_runtime"],
      output.io,
    );
    expect(code).toBe(0);
    expect(output.stdout.join("")).toContain(
      "CREATE POLICY posts_tenant_isolation ON posts",
    );
  });

  it("supports --json with the SQL embedded", async () => {
    const output = captureIo(await temporaryDirectory());
    const code = await runCli(
      [
        "policy",
        "--table",
        "posts",
        "--table",
        "comments",
        "--role",
        "runtime",
        "--json",
      ],
      output.io,
    );
    expect(code).toBe(0);
    const parsed = JSON.parse(output.stdout.join("")) as {
      command: string;
      tables: string[];
      role: string;
      tenantColumn: string;
      sql: string;
    };
    expect(parsed.command).toBe("policy");
    expect(parsed.tables).toEqual(["posts", "comments"]);
    expect(parsed.role).toBe("runtime");
    expect(parsed.tenantColumn).toBe("tenant_id");
    expect(parsed.sql).toContain("FORCE ROW LEVEL SECURITY");
  });

  it("fails closed without a table or role", async () => {
    const noTable = captureIo(await temporaryDirectory());
    expect(await runCli(["policy", "--role", "r"], noTable.io)).toBe(2);
    expect(noTable.stderr.join("")).toContain("at least one --table");

    const noRole = captureIo(await temporaryDirectory());
    expect(await runCli(["policy", "--table", "posts"], noRole.io)).toBe(2);
    expect(noRole.stderr.join("")).toContain("--role");
  });

  it("rejects policy-only flags on other commands", async () => {
    const output = captureIo(await temporaryDirectory());
    const code = await runCli(
      ["doctor", "--table", "posts", "--role", "r"],
      output.io,
    );
    expect(code).toBe(2);
    expect(output.stderr.join("")).toContain(
      "valid only for the policy command",
    );
  });

  it("lists policy in help", async () => {
    const output = captureIo(await temporaryDirectory());
    await runCli(["help"], output.io);
    expect(output.stdout.join("")).toContain("tenancy policy --table");
  });
});
