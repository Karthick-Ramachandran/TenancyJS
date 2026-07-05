import { describe, expect, it } from "vitest";

import { runProvisionAction } from "../src/commands/provision.js";
import { CliProjectError } from "../src/errors.js";
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

describe("runProvisionAction", () => {
  it("calls the provision hook for a single resolved tenant", async () => {
    const seen: string[] = [];
    const result = await runProvisionAction(
      runtime({
        store: { find: async (id) => ({ id }) },
        provisioner: {
          provision: async (tenant) => {
            seen.push(tenant.id);
          },
        },
      }),
      "provision",
      { id: "acme" },
    );
    expect(seen).toEqual(["acme"]);
    expect(result.ok).toBe(true);
    expect(result.results).toEqual([{ tenantId: "acme", status: "ok" }]);
  });

  it("migrates every tenant with --all and reports partial failure", async () => {
    const result = await runProvisionAction(
      runtime({
        store: { list: async () => [{ id: "a" }, { id: "b" }] },
        provisioner: {
          migrate: async (tenant) => {
            if (tenant.id === "b") throw new Error("boom");
          },
        },
      }),
      "migrate",
      { all: true },
    );
    expect(result.ok).toBe(false);
    expect(result.results).toEqual([
      { tenantId: "a", status: "ok" },
      { tenantId: "b", status: "failed", error: "boom" },
    ]);
  });

  it("errors when the runtime has no provisioner", async () => {
    await expect(
      runProvisionAction(
        runtime({ store: { find: async (id) => ({ id }) } }),
        "provision",
        { id: "acme" },
      ),
    ).rejects.toThrow(/needs a provisioner/);
  });

  it("errors when the requested hook is absent", async () => {
    await expect(
      runProvisionAction(
        runtime({
          store: { find: async (id) => ({ id }) },
          provisioner: { provision: async () => undefined },
        }),
        "deprovision",
        { id: "acme" },
      ),
    ).rejects.toThrow(/does not implement a deprovision\(\) hook/);
  });

  it("errors when a tenant scope needs a store that is absent", async () => {
    await expect(
      runProvisionAction(
        runtime({ provisioner: { provision: async () => undefined } }),
        "provision",
        { id: "acme" },
      ),
    ).rejects.toBeInstanceOf(CliProjectError);
  });

  it("errors when --all needs list() but the store lacks it", async () => {
    await expect(
      runProvisionAction(
        runtime({
          store: { find: async (id) => ({ id }) },
          provisioner: { migrate: async () => undefined },
        }),
        "migrate",
        { all: true },
      ),
    ).rejects.toThrow(/needs "list"/);
  });

  it("errors when resolving a single tenant needs find() the store lacks", async () => {
    await expect(
      runProvisionAction(
        runtime({
          store: { list: async () => [] },
          provisioner: { provision: async () => undefined },
        }),
        "provision",
        { id: "acme" },
      ),
    ).rejects.toThrow(/needs "find"/);
  });

  it("errors when a single target cannot be found", async () => {
    await expect(
      runProvisionAction(
        runtime({
          store: { find: async () => null },
          provisioner: { provision: async () => undefined },
        }),
        "provision",
        { id: "ghost" },
      ),
    ).rejects.toThrow(/No tenant found/);
  });
});
