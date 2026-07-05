import { TenantContextError, TenancyManager } from "tenancyjs-core";
import { TenantResourceCacheError } from "tenancyjs-adapter-shared";
import { describe, expect, it } from "vitest";

import {
  PrismaTenancyConfigurationError,
  createPrismaDatabaseTenancy,
} from "../src/index.js";

interface Tenant {
  readonly id: string;
  readonly database: string;
}

interface FakeClient {
  readonly database: string;
  disconnected: boolean;
}

function harness() {
  const manager = new TenancyManager<Tenant>();
  const created: string[] = [];
  const router = createPrismaDatabaseTenancy<Tenant, FakeClient>({
    manager,
    connection: (tenant) => ({
      key: tenant.database,
      create: () => {
        created.push(tenant.database);
        return { database: tenant.database, disconnected: false };
      },
    }),
    disconnect: (client) => {
      client.disconnected = true;
    },
    maxConnections: 2,
  });
  return { manager, router, created };
}

describe("createPrismaDatabaseTenancy", () => {
  it("rejects invalid options", () => {
    expect(() => createPrismaDatabaseTenancy(null as never)).toThrow(
      PrismaTenancyConfigurationError,
    );
    expect(() =>
      createPrismaDatabaseTenancy({
        manager: new TenancyManager(),
        connection: (() => ({})) as never,
      } as never),
    ).toThrow(PrismaTenancyConfigurationError);
    expect(() =>
      createPrismaDatabaseTenancy({
        manager: new TenancyManager(),
        connection: () => ({ key: "k", create: () => ({}) }),
        disconnect: () => undefined,
        maxConnections: 0,
      } as never),
    ).toThrow(PrismaTenancyConfigurationError);
  });

  it("routes the active tenant to its own client and reuses it", async () => {
    const { manager, router, created } = harness();
    const tenantA: Tenant = { id: "tenant-a", database: "db_a" };

    const first = await manager.runWithTenant(tenantA, () =>
      router.run(async (client) => client.database),
    );
    const second = await manager.runWithTenant(tenantA, () =>
      router.run(async (client) => client.database),
    );
    expect(first).toBe("db_a");
    expect(second).toBe("db_a");
    // Single-flight: the client was created once and reused.
    expect(created).toEqual(["db_a"]);
    await router.close();
  });

  it("fails closed without a tenant context or in central context", async () => {
    const { manager, router } = harness();
    await expect(router.run(async () => 1)).rejects.toBeInstanceOf(
      TenantContextError,
    );
    await expect(
      manager.runInCentralContext(() => router.run(async () => 1)),
    ).rejects.toBeInstanceOf(PrismaTenancyConfigurationError);
    await expect(
      manager.runWithTenant({ id: "t", database: "db" }, () =>
        router.run(undefined as never),
      ),
    ).rejects.toBeInstanceOf(PrismaTenancyConfigurationError);
    await router.close();
  });

  it("rejects a placement collision through the public router", async () => {
    const { manager, router, created } = harness();
    const tenantA: Tenant = { id: "tenant-a", database: "shared-db" };
    const tenantB: Tenant = { id: "tenant-b", database: "shared-db" };

    await manager.runWithTenant(tenantA, () =>
      router.run((client) => client.database),
    );
    await expect(
      manager.runWithTenant(tenantB, () =>
        router.run((client) => client.database),
      ),
    ).rejects.toMatchObject({
      name: TenantResourceCacheError.name,
      code: "TENANCY_RESOURCE_CACHE_COLLISION",
    });
    expect(created).toEqual(["shared-db"]);
    await router.close();
  });
});
