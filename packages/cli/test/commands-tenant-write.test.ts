import { describe, expect, it } from "vitest";

import {
  runTenantActivate,
  runTenantCreate,
  runTenantSuspend,
} from "../src/commands/tenant.js";
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

describe("runTenantCreate", () => {
  it("passes id and --set fields to the store", async () => {
    const seen: Record<string, unknown>[] = [];
    const result = await runTenantCreate(
      runtime({
        create: async (input) => {
          seen.push(input);
          return { id: input.id as string, ...input };
        },
      }),
      { id: "acme", fields: { slug: "acme-inc", plan: "pro" } },
    );
    expect(seen[0]).toEqual({ id: "acme", slug: "acme-inc", plan: "pro" });
    expect(result.subcommand).toBe("create");
    expect(result.tenant.id).toBe("acme");
  });

  it("omits id when none is provided (store generates it)", async () => {
    const result = await runTenantCreate(
      runtime({ create: async (input) => ({ id: "gen", ...input }) }),
      { fields: {} },
    );
    expect(result.tenant.id).toBe("gen");
  });

  it("errors when the store cannot create", async () => {
    await expect(
      runTenantCreate(runtime({ list: async () => [] }), { fields: {} }),
    ).rejects.toThrow(/needs "create"/);
  });

  it("errors when the runtime has no store", async () => {
    await expect(
      runTenantCreate(runtime(undefined), { fields: {} }),
    ).rejects.toBeInstanceOf(CliProjectError);
  });
});

describe("runTenantSuspend / runTenantActivate", () => {
  it("suspends and activates through the store", async () => {
    const store = {
      suspend: async (id: string) => ({ id, status: "suspended" }),
      activate: async (id: string) => ({ id, status: "active" }),
    };
    await expect(
      runTenantSuspend(runtime(store), "acme"),
    ).resolves.toMatchObject({
      subcommand: "suspend",
      tenant: { id: "acme", status: "suspended" },
    });
    await expect(
      runTenantActivate(runtime(store), "acme"),
    ).resolves.toMatchObject({
      subcommand: "activate",
      tenant: { id: "acme", status: "active" },
    });
  });

  it("requires a non-empty id", async () => {
    await expect(
      runTenantSuspend(runtime({ suspend: async () => ({ id: "" }) }), ""),
    ).rejects.toBeInstanceOf(CliUsageError);
  });

  it("errors when the store cannot perform the lifecycle action", async () => {
    await expect(
      runTenantActivate(runtime({ list: async () => [] }), "acme"),
    ).rejects.toThrow(/needs "activate"/);
  });
});
