import { describe, expect, it, vi } from "vitest";

import {
  TenantResourceCacheError,
  createTenantResourceCache,
} from "../src/index.js";

interface Resource {
  readonly id: string;
}

describe("TenantResourceCache", () => {
  it("reuses resources and single-flights concurrent creation", async () => {
    const creation = deferred<Resource>();
    const create = vi.fn(() => creation.promise);
    const cache = createTenantResourceCache<Resource>({
      capacity: 2,
      destroy: vi.fn(),
    });
    const first = cache.lease(
      "tenant-a",
      "database-a",
      create,
      (resource) => resource.id,
    );
    const second = cache.lease(
      "tenant-a",
      "database-a",
      create,
      (resource) => resource.id,
    );
    creation.resolve({ id: "resource-a" });

    await expect(Promise.all([first, second])).resolves.toEqual([
      "resource-a",
      "resource-a",
    ]);
    expect(create).toHaveBeenCalledTimes(1);
    await expect(
      cache.lease("tenant-a", "database-a", create, (resource) => resource.id),
    ).resolves.toBe("resource-a");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("rejects tenant and placement collisions before creation", async () => {
    const create = vi.fn(async () => ({ id: "resource" }));
    const cache = createTenantResourceCache<Resource>({
      capacity: 2,
      destroy: vi.fn(),
    });
    await cache.lease("tenant-a", "database-a", create, () => undefined);

    await expect(
      cache.lease("tenant-a", "database-b", create, () => undefined),
    ).rejects.toMatchObject({ code: "TENANCY_RESOURCE_CACHE_COLLISION" });
    await expect(
      cache.lease("tenant-b", "database-a", create, () => undefined),
    ).rejects.toMatchObject({ code: "TENANCY_RESOURCE_CACHE_COLLISION" });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("evicts the least-recently-used idle resource before creating another", async () => {
    const destroyed: string[] = [];
    const cache = createTenantResourceCache<Resource>({
      capacity: 2,
      destroy: async (resource) => {
        destroyed.push(resource.id);
      },
    });
    const use = (tenant: string, key: string) =>
      cache.lease(
        tenant,
        key,
        async () => ({ id: key }),
        (resource) => resource.id,
      );
    await use("tenant-a", "database-a");
    await use("tenant-b", "database-b");
    await use("tenant-a", "database-a");
    await expect(use("tenant-c", "database-c")).resolves.toBe("database-c");

    expect(destroyed).toEqual(["database-b"]);
    expect(cache.size).toBe(2);
  });

  it("fails at capacity while every resource is leased", async () => {
    const hold = deferred<void>();
    const cache = createTenantResourceCache<Resource>({
      capacity: 1,
      destroy: vi.fn(),
    });
    const active = cache.lease(
      "tenant-a",
      "database-a",
      async () => ({ id: "a" }),
      async () => hold.promise,
    );
    await Promise.resolve();
    await Promise.resolve();

    await expect(
      cache.lease(
        "tenant-b",
        "database-b",
        async () => ({ id: "b" }),
        () => undefined,
      ),
    ).rejects.toMatchObject({ code: "TENANCY_RESOURCE_CACHE_CAPACITY" });
    hold.resolve();
    await active;
  });

  it("retains an idle resource when eviction destruction fails", async () => {
    const destroy = vi
      .fn<(resource: Resource) => Promise<void>>()
      .mockRejectedValueOnce(new Error("postgresql://secret"))
      .mockResolvedValue(undefined);
    const cache = createTenantResourceCache<Resource>({
      capacity: 1,
      destroy,
    });
    const createA = vi.fn(async () => ({ id: "a" }));
    await cache.lease("tenant-a", "database-a", createA, () => undefined);

    const failed = cache.lease(
      "tenant-b",
      "database-b",
      async () => ({ id: "b" }),
      () => undefined,
    );
    await expect(failed).rejects.toMatchObject({
      code: "TENANCY_RESOURCE_CACHE_DESTRUCTION",
    });
    await expect(failed).rejects.not.toThrow("secret");
    expect(cache.size).toBe(1);
    await cache.lease("tenant-a", "database-a", createA, () => undefined);
    expect(createA).toHaveBeenCalledTimes(1);
  });

  it("does not cache creation failures or disclose their cause", async () => {
    const cache = createTenantResourceCache<Resource>({
      capacity: 1,
      destroy: vi.fn(),
    });
    const create = vi
      .fn<() => Promise<Resource>>()
      .mockRejectedValueOnce(new Error("postgresql://user:secret@db/private"))
      .mockResolvedValueOnce({ id: "safe" });

    const failed = cache.lease(
      "tenant-a",
      "database-a",
      create,
      () => undefined,
    );
    await expect(failed).rejects.toMatchObject({
      code: "TENANCY_RESOURCE_CACHE_CREATION",
    });
    await expect(failed).rejects.not.toThrow("secret");
    await expect(
      cache.lease("tenant-a", "database-a", create, (resource) => resource.id),
    ).resolves.toBe("safe");
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("releases callback failures and preserves the application error", async () => {
    const cache = createTenantResourceCache<Resource>({
      capacity: 1,
      destroy: vi.fn(),
    });
    const failure = new Error("application failure");
    await expect(
      cache.lease(
        "tenant-a",
        "database-a",
        async () => ({ id: "a" }),
        () => {
          throw failure;
        },
      ),
    ).rejects.toBe(failure);
    await expect(cache.close()).resolves.toBeUndefined();
  });

  it("blocks acquisitions while closing and permits shutdown retry after leases finish", async () => {
    const hold = deferred<void>();
    const destroy = vi.fn();
    const cache = createTenantResourceCache<Resource>({ capacity: 1, destroy });
    const active = cache.lease(
      "tenant-a",
      "database-a",
      async () => ({ id: "a" }),
      async () => hold.promise,
    );
    await Promise.resolve();
    await Promise.resolve();

    await expect(cache.close()).rejects.toMatchObject({
      code: "TENANCY_RESOURCE_CACHE_LEASED",
    });
    await expect(
      cache.lease(
        "tenant-b",
        "database-b",
        async () => ({ id: "b" }),
        () => undefined,
      ),
    ).rejects.toMatchObject({ code: "TENANCY_RESOURCE_CACHE_CLOSED" });
    hold.resolve();
    await active;
    await expect(cache.close()).resolves.toBeUndefined();
    await expect(cache.close()).resolves.toBeUndefined();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("continues shutdown after destruction failures and retains failures for retry", async () => {
    const attempts = new Map<string, number>();
    const cache = createTenantResourceCache<Resource>({
      capacity: 2,
      destroy: async (resource) => {
        const attempt = (attempts.get(resource.id) ?? 0) + 1;
        attempts.set(resource.id, attempt);
        if (resource.id === "a" && attempt === 1) {
          throw new Error("postgresql://secret");
        }
      },
    });
    for (const id of ["a", "b"]) {
      await cache.lease(
        `tenant-${id}`,
        `database-${id}`,
        async () => ({ id }),
        () => undefined,
      );
    }

    const failed = cache.close();
    await expect(failed).rejects.toMatchObject({
      code: "TENANCY_RESOURCE_CACHE_DESTRUCTION",
    });
    await expect(failed).rejects.not.toThrow("secret");
    expect(attempts.get("b")).toBe(1);
    expect(cache.size).toBe(1);
    await expect(cache.close()).resolves.toBeUndefined();
    expect(attempts.get("a")).toBe(2);
  });

  it("rejects invalid configuration and secret-shaped placement keys", async () => {
    for (const options of [
      null,
      {},
      { capacity: 0, destroy: vi.fn() },
      { capacity: 1.5, destroy: vi.fn() },
      { capacity: 1, destroy: null },
    ]) {
      expect(() => createTenantResourceCache(options as never)).toThrow(
        TenantResourceCacheError,
      );
    }
    const cache = createTenantResourceCache<Resource>({
      capacity: 1,
      destroy: vi.fn(),
    });
    const invalidPairs: readonly (readonly [string, string])[] = [
      ["", "database-a"],
      ["tenant-a", ""],
      ["tenant-a", "postgresql://user:secret@db/private"],
      ["tenant-a", "x".repeat(129)],
    ];
    for (const [tenant, key] of invalidPairs) {
      await expect(
        cache.lease(
          tenant,
          key,
          async () => ({ id: "a" }),
          () => undefined,
        ),
      ).rejects.toMatchObject({
        code: "TENANCY_RESOURCE_CACHE_CONFIGURATION",
      });
    }
    await expect(
      cache.lease("tenant-a", "database-a", null as never, () => undefined),
    ).rejects.toMatchObject({ code: "TENANCY_RESOURCE_CACHE_CONFIGURATION" });
    await expect(
      cache.lease(
        "tenant-a",
        "database-a",
        async () => ({ id: "a" }),
        null as never,
      ),
    ).rejects.toMatchObject({ code: "TENANCY_RESOURCE_CACHE_CONFIGURATION" });
  });
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
