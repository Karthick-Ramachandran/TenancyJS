import { describe, expect, it } from "vitest";

import {
  TenancyManager,
  TenantContextError,
  captureTenancy,
  runWithTenancySnapshot,
} from "../src/index.js";

interface Tenant {
  readonly id: string;
  readonly name?: string;
}

describe("captureTenancy / runWithTenancySnapshot", () => {
  it("captures the tenant scope and restores it after the scope has exited", async () => {
    const manager = new TenancyManager<Tenant>();
    let snapshot!: ReturnType<typeof captureTenancy<Tenant>>;

    await manager.runWithTenant({ id: "acme", name: "Acme" }, async () => {
      snapshot = captureTenancy(manager);
    });

    // The async scope is gone — a background job would run unscoped here.
    expect(manager.getContext()).toBeUndefined();
    expect(snapshot).toEqual({
      mode: "tenant",
      tenant: { id: "acme", name: "Acme" },
    });

    const seen = await runWithTenancySnapshot(manager, snapshot, () =>
      manager.getTenantOrFail(),
    );
    expect(seen).toEqual({ id: "acme", name: "Acme" });
  });

  it("survives JSON serialization (a real job payload)", async () => {
    const manager = new TenancyManager<Tenant>();
    let snapshot!: ReturnType<typeof captureTenancy<Tenant>>;
    await manager.runWithTenant({ id: "globex" }, async () => {
      snapshot = captureTenancy(manager);
    });

    const roundTripped = JSON.parse(JSON.stringify(snapshot));
    const seen = await runWithTenancySnapshot(manager, roundTripped, () =>
      manager.getTenant(),
    );
    expect(seen).toEqual({ id: "globex" });
  });

  it("captures and restores the central scope", async () => {
    const manager = new TenancyManager<Tenant>();
    let snapshot!: ReturnType<typeof captureTenancy<Tenant>>;
    await manager.runInCentralContext(async () => {
      snapshot = captureTenancy(manager);
    });
    expect(snapshot).toEqual({ mode: "central" });

    const mode = await runWithTenancySnapshot(
      manager,
      snapshot,
      () => manager.getContext()?.mode,
    );
    expect(mode).toBe("central");
    // Central is not a tenant: tenant-scoped access still fails closed.
    await expect(
      runWithTenancySnapshot(manager, snapshot, () =>
        manager.getTenantOrFail(),
      ),
    ).rejects.toBeInstanceOf(TenantContextError);
  });

  it("throws when capturing outside any scope", () => {
    const manager = new TenancyManager<Tenant>();
    expect(() => captureTenancy(manager)).toThrow(TenantContextError);
  });
});
