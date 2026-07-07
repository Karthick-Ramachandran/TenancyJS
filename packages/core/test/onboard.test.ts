import { describe, expect, it, vi } from "vitest";

import {
  TenancyManager,
  TenantStoreContractError,
  defineTenancyRuntime,
  onboardTenant,
} from "../src/index.js";

interface Tenant {
  readonly id: string;
  readonly name?: string;
}

function harness(
  options: {
    provision?: () => Promise<void>;
    migrate?: () => Promise<void>;
    withProvisioner?: boolean;
  } = {},
) {
  const order: string[] = [];
  const store = {
    create: vi.fn(async (input: { id?: string }) => {
      order.push("create");
      return { id: input.id ?? "acme", ...input } as Tenant;
    }),
    delete: vi.fn(async () => {
      order.push("delete");
    }),
  };
  const provisioner = {
    provision: vi.fn(async () => {
      order.push("provision");
      await options.provision?.();
    }),
    migrate: vi.fn(async () => {
      order.push("migrate");
      await options.migrate?.();
    }),
    deprovision: vi.fn(async () => {
      order.push("deprovision");
    }),
  };
  const runtime = defineTenancyRuntime<Tenant>({
    manager: new TenancyManager<Tenant>(),
    store,
    ...(options.withProvisioner === false ? {} : { provisioner }),
  });
  return { runtime, store, provisioner, order };
}

describe("onboardTenant", () => {
  it("records, provisions, and migrates in order", async () => {
    const { runtime, order } = harness();
    const tenant = await onboardTenant(runtime, { id: "acme", name: "Acme" });
    expect(tenant).toEqual({ id: "acme", name: "Acme" });
    expect(order).toEqual(["create", "provision", "migrate"]);
  });

  it("skips provisioning when there is no provisioner (row-level)", async () => {
    const { runtime, order } = harness({ withProvisioner: false });
    await onboardTenant(runtime, { id: "acme" });
    expect(order).toEqual(["create"]);
  });

  it("rolls back (deprovision + delete) when provisioning fails, and rethrows", async () => {
    const { runtime, order, provisioner, store } = harness({
      provision: async () => {
        throw new Error("provision boom");
      },
    });
    await expect(onboardTenant(runtime, { id: "acme" })).rejects.toThrow(
      "provision boom",
    );
    expect(order).toEqual(["create", "provision", "deprovision", "delete"]);
    expect(provisioner.deprovision).toHaveBeenCalledOnce();
    expect(store.delete).toHaveBeenCalledWith("acme");
    // migrate never ran
    expect(provisioner.migrate).not.toHaveBeenCalled();
  });

  it("rolls back when migration fails", async () => {
    const { runtime, order } = harness({
      migrate: async () => {
        throw new Error("migrate boom");
      },
    });
    await expect(onboardTenant(runtime, { id: "acme" })).rejects.toThrow(
      "migrate boom",
    );
    expect(order).toEqual([
      "create",
      "provision",
      "migrate",
      "deprovision",
      "delete",
    ]);
  });

  it("throws when the runtime has no tenant store", async () => {
    const runtime = defineTenancyRuntime<Tenant>({
      manager: new TenancyManager<Tenant>(),
    });
    await expect(onboardTenant(runtime, { id: "acme" })).rejects.toBeInstanceOf(
      TenantStoreContractError,
    );
  });
});
