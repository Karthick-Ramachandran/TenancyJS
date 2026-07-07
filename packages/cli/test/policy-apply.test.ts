import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { runPolicyApply } from "../src/commands/policy.js";

const fixtures = resolve(
  fileURLToPath(new URL("./fixtures/runtime", import.meta.url)),
);

describe("policy --apply", () => {
  const temporaries: string[] = [];
  afterEach(async () => {
    delete process.env.POLICY_APPLY_OUT;
    await Promise.all(
      temporaries.splice(0).map((t) => rm(t, { recursive: true, force: true })),
    );
  });

  it("applies the generated forced-RLS DDL through the runtime admin connection", async () => {
    const dir = await mkdtemp(join(tmpdir(), "policy-apply-"));
    temporaries.push(dir);
    const out = join(dir, "applied.sql");
    process.env.POLICY_APPLY_OUT = out;

    const result = await runPolicyApply({
      tables: ["posts", "comments"],
      role: "app_runtime",
      root: fixtures,
      configPath: "policy-admin.config.mjs",
    });

    expect(result).toMatchObject({
      applied: true,
      tables: ["posts", "comments"],
      role: "app_runtime",
      tenantColumn: "tenant_id",
    });
    const sql = await readFile(out, "utf8");
    // Exactly the SQL `tenancy policy` prints — generate and apply never drift.
    expect(sql).toContain("CREATE POLICY posts_tenant_isolation ON posts");
    expect(sql).toContain("ALTER TABLE comments FORCE ROW LEVEL SECURITY;");
    expect(sql).toContain(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON comments TO app_runtime",
    );
  });

  it("fails closed when the runtime exposes no admin connection", async () => {
    await expect(
      runPolicyApply({
        tables: ["posts"],
        role: "app_runtime",
        root: fixtures,
        configPath: "policy-no-admin.config.mjs",
      }),
    ).rejects.toThrow(/privileged admin connection/);
  });

  it("validates identifiers before touching the database", async () => {
    await expect(
      runPolicyApply({
        tables: [],
        role: "app_runtime",
        root: fixtures,
        configPath: "policy-admin.config.mjs",
      }),
    ).rejects.toThrow(/at least one --table/);
    await expect(
      runPolicyApply({
        tables: ["posts"],
        role: "bad role",
        root: fixtures,
        configPath: "policy-admin.config.mjs",
      }),
    ).rejects.toThrow(/plain SQL identifier/);
  });
});
