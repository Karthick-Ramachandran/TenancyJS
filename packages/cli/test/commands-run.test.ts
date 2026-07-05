import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { runScript } from "../src/commands/run.js";
import { CliProjectError, CliUsageError } from "../src/errors.js";
import type { LoadedTenancyRuntime } from "../src/runtime-loader.js";

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

async function markerFile(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "tenancy-run-"));
  cleanup.push(dir);
  const file = path.join(dir, "marker.log");
  process.env.TENANCYJS_RUN_MARKER = file;
  return file;
}

function runtime(
  overrides: Partial<LoadedTenancyRuntime> = {},
): LoadedTenancyRuntime {
  return {
    manager: {
      runWithTenant: async (_tenant, callback) => callback(),
      runInCentralContext: async (callback) => callback(),
      getContext: () => undefined,
    },
    store: { find: async (id) => ({ id }) },
    adapters: [],
    async dispose() {},
    ...overrides,
  };
}

describe("runScript", () => {
  it("runs top-level and default export inside a tenant scope", async () => {
    const file = await markerFile();
    const result = await runScript(runtime(), {
      root: FIXTURES,
      script: "scripts/run-marker.mjs",
      scope: { mode: "tenant", tenantId: "acme" },
    });
    expect(result.scope).toEqual({ mode: "tenant", tenantId: "acme" });
    const log = await readFile(file, "utf8");
    expect(log).toContain("top-level");
    expect(log).toContain("default");
  });

  it("runs inside the central scope without touching the store", async () => {
    const file = await markerFile();
    const result = await runScript(runtime({ store: undefined as never }), {
      root: FIXTURES,
      script: "scripts/run-central.mjs",
      scope: { mode: "central" },
    });
    expect(result.scope).toEqual({ mode: "central" });
    expect(await readFile(file, "utf8")).toContain("central-ran");
  });

  it("runs a script that has no default export (top-level only)", async () => {
    const file = await markerFile();
    await runScript(runtime({ store: undefined as never }), {
      root: FIXTURES,
      script: "scripts/run-no-default.mjs",
      scope: { mode: "central" },
    });
    expect(await readFile(file, "utf8")).toContain("top-level-only");
  });

  it("propagates a throwing script", async () => {
    await expect(
      runScript(runtime(), {
        root: FIXTURES,
        script: "scripts/run-throws.mjs",
        scope: { mode: "tenant", tenantId: "acme" },
      }),
    ).rejects.toThrow(/script failed inside tenant scope/);
  });

  it("errors on a missing script", async () => {
    await expect(
      runScript(runtime(), {
        root: FIXTURES,
        script: "scripts/nope.mjs",
        scope: { mode: "central" },
      }),
    ).rejects.toBeInstanceOf(CliUsageError);
  });

  it("errors when a tenant scope is requested but no tenant matches", async () => {
    await expect(
      runScript(runtime({ store: { find: async () => null } }), {
        root: FIXTURES,
        script: "scripts/run-marker.mjs",
        scope: { mode: "tenant", tenantId: "ghost" },
      }),
    ).rejects.toThrow(/No tenant found/);
  });

  it("errors when a tenant scope is requested but the runtime has no store", async () => {
    await expect(
      runScript(runtime({ store: undefined as never }), {
        root: FIXTURES,
        script: "scripts/run-marker.mjs",
        scope: { mode: "tenant", tenantId: "acme" },
      }),
    ).rejects.toBeInstanceOf(CliProjectError);
  });

  it("errors when the store cannot find", async () => {
    await expect(
      runScript(runtime({ store: { list: async () => [] } }), {
        root: FIXTURES,
        script: "scripts/run-marker.mjs",
        scope: { mode: "tenant", tenantId: "acme" },
      }),
    ).rejects.toThrow(/needs "find"/);
  });
});
