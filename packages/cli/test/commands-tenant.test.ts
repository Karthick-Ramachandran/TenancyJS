import { describe, expect, it } from "vitest";

import { runTenantList, runTenantShow } from "../src/commands/tenant.js";
import { CliProjectError, CliUsageError } from "../src/errors.js";
import type { LoadedTenancyRuntime } from "../src/runtime-loader.js";

function runtime(store: LoadedTenancyRuntime["store"]): LoadedTenancyRuntime {
  return {
    manager: {
      runWithTenant: async (_tenant, callback) => callback(),
      runInCentralContext: async (callback) => callback(),
      getContext: () => undefined,
    },
    ...(store === undefined ? {} : { store }),
    adapters: [],
    async dispose() {},
  };
}

describe("runTenantList", () => {
  it("returns every tenant from the store", async () => {
    const result = await runTenantList(
      runtime({ list: async () => [{ id: "a" }, { id: "b" }] }),
    );
    expect(result).toEqual({
      schemaVersion: 1,
      command: "tenant",
      subcommand: "list",
      count: 2,
      tenants: [{ id: "a" }, { id: "b" }],
    });
  });

  it("errors when the runtime has no store", async () => {
    await expect(runTenantList(runtime(undefined))).rejects.toBeInstanceOf(
      CliProjectError,
    );
  });

  it("errors when the store cannot list", async () => {
    await expect(
      runTenantList(runtime({ find: async () => null })),
    ).rejects.toThrow(/needs "list"/);
  });
});

describe("runTenantShow", () => {
  it("returns the matching tenant", async () => {
    const result = await runTenantShow(
      runtime({ find: async (id) => ({ id, status: "active" }) }),
      "acme",
    );
    expect(result.tenant).toEqual({ id: "acme", status: "active" });
  });

  it("errors on an empty id", async () => {
    await expect(
      runTenantShow(runtime({ find: async () => null }), ""),
    ).rejects.toBeInstanceOf(CliUsageError);
  });

  it("errors when the store cannot find", async () => {
    await expect(
      runTenantShow(runtime({ list: async () => [] }), "acme"),
    ).rejects.toThrow(/needs "find"/);
  });

  it("errors when no tenant matches", async () => {
    await expect(
      runTenantShow(runtime({ find: async () => null }), "missing"),
    ).rejects.toThrow(/No tenant found/);
  });
});
