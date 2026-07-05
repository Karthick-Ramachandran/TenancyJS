import { describe, expect, it, vi } from "vitest";

import {
  InvalidTenancyRuntimeError,
  TenancyManager,
  assertTenancyRuntime,
  defineTenancyRuntime,
  type TenantStore,
} from "../src/index.js";

interface Tenant {
  readonly id: string;
}

describe("defineTenancyRuntime", () => {
  it("builds a branded runtime with defaults", async () => {
    const manager = new TenancyManager<Tenant>();
    const runtime = defineTenancyRuntime({ manager });

    expect(runtime.manager).toBe(manager);
    expect(runtime.adapters).toEqual([]);
    expect(runtime.store).toBeUndefined();
    expect(() => assertTenancyRuntime(runtime)).not.toThrow();
    await expect(runtime.dispose()).resolves.toBeUndefined();
  });

  it("hardens the provided store", async () => {
    const raw: TenantStore<Tenant> = { find: async () => ({ id: "wrong" }) };
    const runtime = defineTenancyRuntime({
      manager: new TenancyManager<Tenant>(),
      store: raw,
    });
    // The hardened wrapper, not the raw store, is exposed.
    expect(runtime.store).not.toBe(raw);
    await expect(runtime.store!.find!("asked")).rejects.toMatchObject({
      code: "TENANCY_STORE_ID_MISMATCH",
    });
  });

  it("delegates dispose to the host hook exactly once per call", async () => {
    const dispose = vi.fn(async () => undefined);
    const runtime = defineTenancyRuntime({
      manager: new TenancyManager<Tenant>(),
      dispose,
    });
    await runtime.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("rejects a missing or non-manager input", () => {
    expect(() => defineTenancyRuntime(null as never)).toThrow(
      /configuration object/,
    );
    expect(() => defineTenancyRuntime({} as never)).toThrow(
      InvalidTenancyRuntimeError,
    );
    expect(() => defineTenancyRuntime({ manager: {} as never })).toThrow(
      /new TenancyManager/,
    );
  });

  it("rejects a non-object store field", () => {
    expect(() =>
      defineTenancyRuntime({
        manager: new TenancyManager<Tenant>(),
        store: "nope" as never,
      }),
    ).toThrow(/TenantStore contract/);
  });

  it("rejects a non-array adapters field", () => {
    expect(() =>
      defineTenancyRuntime({
        manager: new TenancyManager<Tenant>(),
        adapters: {} as never,
      }),
    ).toThrow(InvalidTenancyRuntimeError);
  });
});

describe("assertTenancyRuntime", () => {
  it("rejects anything not produced by defineTenancyRuntime", () => {
    expect(() => assertTenancyRuntime(null)).toThrow(
      InvalidTenancyRuntimeError,
    );
    expect(() => assertTenancyRuntime({})).toThrow(InvalidTenancyRuntimeError);
    expect(() =>
      assertTenancyRuntime({ manager: new TenancyManager() }),
    ).toThrow(/defineTenancyRuntime/);
  });
});
