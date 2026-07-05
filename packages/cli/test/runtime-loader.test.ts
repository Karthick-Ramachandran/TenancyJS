import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CliProjectError, CliUsageError } from "../src/errors.js";
import { loadTenancyRuntime } from "../src/runtime-loader.js";

const FIXTURES = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "runtime",
);

describe("loadTenancyRuntime", () => {
  it("loads a branded runtime from an explicit --config path", async () => {
    const runtime = await loadTenancyRuntime({
      root: FIXTURES,
      configPath: "valid.config.mjs",
    });
    expect(runtime.adapters).toEqual([]);
    await expect(runtime.store!.list!()).resolves.toEqual([
      { id: "alpha" },
      { id: "beta" },
    ]);
    await expect(runtime.dispose()).resolves.toBeUndefined();
  });

  it("strips types and loads a .ts config with no transpiler (Node 24)", async () => {
    const runtime = await loadTenancyRuntime({
      root: FIXTURES,
      configPath: "typed.config.ts",
    });
    await expect(runtime.store!.list!()).resolves.toEqual([
      { id: "typed-alpha" },
    ]);
  });

  it("invokes a factory default export", async () => {
    const runtime = await loadTenancyRuntime({
      root: FIXTURES,
      configPath: "factory.config.mjs",
    });
    expect(runtime.store).toBeUndefined();
    expect(runtime.adapters).toEqual([]);
  });

  it("falls back to a named `runtime` export", async () => {
    const runtime = await loadTenancyRuntime({
      root: FIXTURES,
      configPath: "named.config.mjs",
    });
    expect(runtime.adapters).toEqual([]);
  });

  it("falls back to a named `tenancy` export", async () => {
    const runtime = await loadTenancyRuntime({
      root: FIXTURES,
      configPath: "tenancy-export.config.mjs",
    });
    expect(runtime.adapters).toEqual([]);
  });

  it("rejects a module that exports no recognisable runtime", async () => {
    await expect(
      loadTenancyRuntime({
        root: FIXTURES,
        configPath: "no-runtime-export.config.mjs",
      }),
    ).rejects.toBeInstanceOf(CliProjectError);
  });

  it("surfaces a config that throws a non-Error value", async () => {
    await expect(
      loadTenancyRuntime({
        root: FIXTURES,
        configPath: "string-throw.config.mjs",
      }),
    ).rejects.toThrow(/plain string failure/);
  });

  it("discovers a default config file when no --config is given", async () => {
    const runtime = await loadTenancyRuntime({
      root: path.join(FIXTURES, "discovery"),
    });
    await expect(runtime.store!.list!()).resolves.toEqual([{ id: "found" }]);
  });

  it("rejects an object not built with defineTenancyRuntime", async () => {
    await expect(
      loadTenancyRuntime({
        root: FIXTURES,
        configPath: "unbranded.config.mjs",
      }),
    ).rejects.toBeInstanceOf(CliProjectError);
  });

  it("wraps a config that throws while loading", async () => {
    await expect(
      loadTenancyRuntime({ root: FIXTURES, configPath: "throws.config.mjs" }),
    ).rejects.toBeInstanceOf(CliProjectError);
  });

  it("wraps a factory that throws while building the runtime", async () => {
    await expect(
      loadTenancyRuntime({
        root: FIXTURES,
        configPath: "factory-throws.config.mjs",
      }),
    ).rejects.toThrow(/threw while building the runtime/);
  });

  it("reports a clear usage error when --config does not exist", async () => {
    await expect(
      loadTenancyRuntime({ root: FIXTURES, configPath: "missing.config.mjs" }),
    ).rejects.toBeInstanceOf(CliUsageError);
  });

  it("reports a project error when no config can be discovered", async () => {
    await expect(
      loadTenancyRuntime({ root: path.join(FIXTURES, "empty") }),
    ).rejects.toBeInstanceOf(CliProjectError);
  });
});
