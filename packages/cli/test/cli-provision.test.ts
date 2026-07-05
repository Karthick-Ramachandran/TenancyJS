import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { runCli, type CliIo } from "../src/index.js";

const FIXTURES = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "runtime",
);

function captureIo(): { io: CliIo; stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    io: {
      cwd: FIXTURES,
      writeStdout: (value) => stdout.push(value),
      writeStderr: (value) => stderr.push(value),
    },
  };
}

const config = ["--config", "provisioner.config.mjs"];

describe("runCli tenant provision/deprovision", () => {
  it("provisions a single tenant and exits 0", async () => {
    const output = captureIo();
    const code = await runCli(
      ["tenant", "provision", "seed", ...config],
      output.io,
    );
    expect(code).toBe(0);
    expect(output.stdout.join("")).toContain("Provisioned 1/1 tenant(s).");
  });

  it("deprovisions a single tenant", async () => {
    const output = captureIo();
    const code = await runCli(
      ["tenant", "deprovision", "seed", ...config],
      output.io,
    );
    expect(code).toBe(0);
    expect(output.stdout.join("")).toContain("Deprovisioned 1/1 tenant(s).");
  });

  it("requires an id and forbids --all for deprovision", async () => {
    const missing = captureIo();
    expect(await runCli(["tenant", "deprovision", ...config], missing.io)).toBe(
      2,
    );
    expect(missing.stderr.join("")).toMatch(/deprovision requires <id>/);

    const all = captureIo();
    expect(
      await runCli(["tenant", "deprovision", "--all", ...config], all.io),
    ).toBe(2);
    expect(all.stderr.join("")).toMatch(
      /--all is valid only for tenant migrate/,
    );
  });

  it("errors clearly when the runtime has no provisioner", async () => {
    const output = captureIo();
    const code = await runCli(
      ["tenant", "provision", "seed", "--config", "store-writable.config.mjs"],
      output.io,
    );
    expect(code).toBe(2);
    expect(output.stderr.join("")).toMatch(/needs a provisioner/);
  });
});

describe("runCli tenant migrate", () => {
  it("migrates a single tenant", async () => {
    const output = captureIo();
    const code = await runCli(
      ["tenant", "migrate", "seed", ...config],
      output.io,
    );
    expect(code).toBe(0);
    expect(output.stdout.join("")).toContain("Migrated 1/1 tenant(s).");
  });

  it("migrates all tenants, exits 2 on partial failure, redacting secrets", async () => {
    const output = captureIo();
    const code = await runCli(
      ["tenant", "migrate", "--all", ...config],
      output.io,
    );
    expect(code).toBe(2);
    const text = output.stdout.join("");
    expect(text).toContain("OK seed");
    expect(text).toContain("FAIL broken");
    expect(text).toContain("Migrated 1/2 tenant(s).");
    expect(text).toContain("[REDACTED]");
    expect(text).not.toContain("secret");
  });

  it("supports --json", async () => {
    const output = captureIo();
    await runCli(["tenant", "migrate", "seed", ...config, "--json"], output.io);
    expect(output.stdout.join("")).toContain('"ok": true');
  });

  it("redacts a failing hook's secret in --json output", async () => {
    const output = captureIo();
    const code = await runCli(
      ["tenant", "migrate", "broken", ...config, "--json"],
      output.io,
    );
    expect(code).toBe(2);
    const text = output.stdout.join("");
    expect(text).toContain('"ok": false');
    // The hook throws a message containing a connection string; it must not leak.
    expect(text).toContain("[REDACTED]");
    expect(text).not.toContain("secret@db");
  });

  it("re-hardens the store so a destructive deprovision on a wrong-tenant find is blocked", async () => {
    const output = captureIo();
    const code = await runCli(
      ["tenant", "deprovision", "victim", "--config", "store-evil.config.mjs"],
      output.io,
    );
    // Must fail-closed on the id mismatch, never reaching the drop hook.
    expect(code).toBe(2);
    expect(output.stderr.join("")).toMatch(/mismatched tenant|but returned/i);
  });

  it("rejects --all outside tenant commands", async () => {
    const output = captureIo();
    const code = await runCli(["doctor", "--all"], output.io);
    expect(code).toBe(2);
    expect(output.stderr.join("")).toMatch(/--all is valid only/);
  });
});
