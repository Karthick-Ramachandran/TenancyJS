import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { runCli, type CliIo } from "../src/index.js";
import { formatRunResult } from "../src/output.js";

const FIXTURES = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "runtime",
);

const cleanup: string[] = [];
afterEach(async () => {
  delete process.env.TENANCYJS_RUN_MARKER;
  await Promise.all(
    cleanup.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

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

async function markerFile(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "tenancy-cli-run-"));
  cleanup.push(dir);
  const file = path.join(dir, "marker.log");
  process.env.TENANCYJS_RUN_MARKER = file;
  return file;
}

describe("runCli run", () => {
  it("runs a script in a tenant scope resolved from the store", async () => {
    const file = await markerFile();
    const output = captureIo();
    const code = await runCli(
      [
        "run",
        "scripts/cli-run-tenant.mjs",
        "--tenant",
        "seed",
        "--config",
        "store-writable.config.mjs",
      ],
      output.io,
    );
    expect(code).toBe(0);
    expect(output.stdout.join("")).toMatch(/Ran .* in tenant "seed"\./);
    expect(await readFile(file, "utf8")).toContain("tenant-ran");
  });

  it("runs a script in the central scope with --json", async () => {
    const file = await markerFile();
    const output = captureIo();
    const code = await runCli(
      [
        "run",
        "scripts/cli-run-central.mjs",
        "--central",
        "--config",
        "store-writable.config.mjs",
        "--json",
      ],
      output.io,
    );
    expect(code).toBe(0);
    expect(output.stdout.join("")).toContain('"mode": "central"');
    expect(await readFile(file, "utf8")).toContain("central-ran");
  });

  it("requires a scope", async () => {
    const output = captureIo();
    const code = await runCli(
      [
        "run",
        "scripts/cli-run-tenant.mjs",
        "--config",
        "store-writable.config.mjs",
      ],
      output.io,
    );
    expect(code).toBe(2);
    expect(output.stderr.join("")).toMatch(/requires a scope/);
  });

  it("rejects both --central and --tenant", async () => {
    const output = captureIo();
    const code = await runCli(
      ["run", "scripts/cli-run-tenant.mjs", "--central", "--tenant", "seed"],
      output.io,
    );
    expect(code).toBe(2);
    expect(output.stderr.join("")).toMatch(/not both/);
  });

  it("requires a script path", async () => {
    const output = captureIo();
    const code = await runCli(["run", "--central"], output.io);
    expect(code).toBe(2);
    expect(output.stderr.join("")).toMatch(/requires a <script>/);
  });

  it("rejects --tenant on non-run commands", async () => {
    const output = captureIo();
    const code = await runCli(["doctor", "--tenant", "x"], output.io);
    expect(code).toBe(2);
    expect(output.stderr.join("")).toMatch(/valid only for the run command/);
  });
});

describe("formatRunResult", () => {
  it("describes both tenant and central scopes", () => {
    expect(
      formatRunResult({
        schemaVersion: 1,
        command: "run",
        script: "seed.mjs",
        scope: { mode: "tenant", tenantId: "acme" },
      }),
    ).toContain('Ran seed.mjs in tenant "acme".');
    expect(
      formatRunResult({
        schemaVersion: 1,
        command: "run",
        script: "seed.mjs",
        scope: { mode: "central" },
      }),
    ).toContain("Ran seed.mjs in central scope.");
  });
});
