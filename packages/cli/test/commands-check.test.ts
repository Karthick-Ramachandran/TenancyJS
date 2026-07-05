import { describe, expect, it } from "vitest";

import { runTenantCheck } from "../src/commands/check.js";
import type { LoadedTenancyRuntime } from "../src/runtime-loader.js";

function runtime(
  overrides: Partial<LoadedTenancyRuntime>,
): LoadedTenancyRuntime {
  return {
    manager: {
      runWithTenant: async (_tenant, callback) => callback(),
      runInCentralContext: async (callback) => callback(),
      getContext: () => undefined,
    },
    adapters: [],
    async dispose() {},
    ...overrides,
  };
}

function checkNamed(
  result: Awaited<ReturnType<typeof runTenantCheck>>,
  name: string,
) {
  return result.checks.find((check) => check.name === name);
}

describe("runTenantCheck", () => {
  it("reports healthy when the store lists successfully", async () => {
    const result = await runTenantCheck(
      runtime({ store: { list: async () => [{ id: "a" }, { id: "b" }] } }),
    );
    expect(result.healthy).toBe(true);
    expect(checkNamed(result, "store")?.status).toBe("ok");
    expect(checkNamed(result, "store.list")?.detail).toContain("2 tenant(s)");
  });

  it("warns (but stays healthy) when no store is configured", async () => {
    const result = await runTenantCheck(runtime({ store: undefined as never }));
    expect(result.healthy).toBe(true);
    expect(checkNamed(result, "store")?.status).toBe("warn");
  });

  it("warns when the store implements no list()", async () => {
    const result = await runTenantCheck(
      runtime({ store: { find: async () => null } }),
    );
    expect(result.healthy).toBe(true);
    expect(checkNamed(result, "store.list")?.status).toBe("warn");
  });

  it("warns when the store implements no known methods", async () => {
    const result = await runTenantCheck(runtime({ store: {} }));
    expect(checkNamed(result, "store")?.status).toBe("warn");
    expect(checkNamed(result, "store")?.detail).toContain("no known methods");
  });

  it("fails when the list probe throws", async () => {
    const result = await runTenantCheck(
      runtime({
        store: {
          list: async () => {
            throw new Error("connection refused");
          },
        },
      }),
    );
    expect(result.healthy).toBe(false);
    expect(checkNamed(result, "store.list")?.status).toBe("fail");
    expect(checkNamed(result, "store.list")?.detail).toContain(
      "connection refused",
    );
  });

  it("reports the adapter count", async () => {
    const result = await runTenantCheck(
      runtime({
        adapters: [{ name: "knex", strategy: "rowLevel" }],
        store: { list: async () => [] },
      }),
    );
    expect(checkNamed(result, "adapters")?.detail).toContain("1 adapter(s)");
  });

  it("marks a tested-supported adapter/strategy as ok", async () => {
    const result = await runTenantCheck(
      runtime({
        adapters: [
          {
            name: "knex",
            strategy: "rowLevel",
            capabilities: { rowLevel: "supported" },
          },
        ],
        store: { list: async () => [] },
      }),
    );
    expect(checkNamed(result, "adapter:knex")?.status).toBe("ok");
    expect(result.healthy).toBe(true);
  });

  it("warns (honestly, not failing) when the adapter/strategy is not tested-supported", async () => {
    const result = await runTenantCheck(
      runtime({
        adapters: [
          {
            name: "prisma",
            strategy: "schemaPerTenant",
            capabilities: { schemaPerTenant: "unsupported" },
          },
          // No capabilities self-report at all -> also untested.
          { name: "custom", strategy: "rowLevel" },
        ],
        store: { list: async () => [] },
      }),
    );
    expect(checkNamed(result, "adapter:prisma")?.status).toBe("warn");
    expect(checkNamed(result, "adapter:prisma")?.detail).toContain(
      "use at your own risk",
    );
    expect(checkNamed(result, "adapter:custom")?.status).toBe("warn");
    expect(checkNamed(result, "adapter:custom")?.detail).toContain("unknown");
    // Untested is a warning, not a failure — the runtime is still usable.
    expect(result.healthy).toBe(true);
  });
});
