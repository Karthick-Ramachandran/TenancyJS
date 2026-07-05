import type { MaybePromise } from "tenancyjs-core";

export type TenantResourceCacheErrorCode =
  | "TENANCY_RESOURCE_CACHE_CONFIGURATION"
  | "TENANCY_RESOURCE_CACHE_CAPACITY"
  | "TENANCY_RESOURCE_CACHE_COLLISION"
  | "TENANCY_RESOURCE_CACHE_CREATION"
  | "TENANCY_RESOURCE_CACHE_DESTRUCTION"
  | "TENANCY_RESOURCE_CACHE_CLOSED"
  | "TENANCY_RESOURCE_CACHE_LEASED";

export class TenantResourceCacheError extends Error {
  readonly code: TenantResourceCacheErrorCode;

  constructor(message: string, code: TenantResourceCacheErrorCode) {
    super(message);
    this.name = "TenantResourceCacheError";
    this.code = code;
  }
}

export interface TenantResourceCacheOptions<TResource extends object> {
  readonly capacity: number;
  readonly destroy: (resource: TResource) => MaybePromise<void>;
}

export interface TenantResourceCache<TResource extends object> {
  readonly capacity: number;
  readonly size: number;
  lease<TResult>(
    tenantId: string,
    placementKey: string,
    create: () => MaybePromise<TResource>,
    callback: (resource: TResource) => MaybePromise<TResult>,
  ): Promise<TResult>;
  close(): Promise<void>;
}

interface CacheEntry<TResource extends object> {
  readonly tenantId: string;
  readonly placementKey: string;
  readonly creating: Promise<TResource>;
  resource: TResource | undefined;
  failed: boolean;
  leases: number;
  lastUsed: number;
}

export function createTenantResourceCache<TResource extends object>(
  options: TenantResourceCacheOptions<TResource>,
): TenantResourceCache<TResource> {
  if (
    options === null ||
    typeof options !== "object" ||
    !Number.isSafeInteger(options.capacity) ||
    options.capacity <= 0 ||
    typeof options.destroy !== "function"
  ) {
    throw cacheError(
      "Tenant resource cache requires a positive capacity and destroy callback.",
      "TENANCY_RESOURCE_CACHE_CONFIGURATION",
    );
  }

  const entries = new Map<string, CacheEntry<TResource>>();
  const tenantPlacements = new Map<string, string>();
  let clock = 0;
  let state: "open" | "closing" | "closed" = "open";
  let gate = Promise.resolve();

  async function withGate<TResult>(
    callback: () => Promise<TResult> | TResult,
  ): Promise<TResult> {
    const previous = gate;
    let release!: () => void;
    gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await callback();
    } finally {
      release();
    }
  }

  function remove(entry: CacheEntry<TResource>): void {
    entries.delete(entry.placementKey);
    if (tenantPlacements.get(entry.tenantId) === entry.placementKey) {
      tenantPlacements.delete(entry.tenantId);
    }
  }

  async function acquire(
    tenantId: string,
    placementKey: string,
    create: () => MaybePromise<TResource>,
  ): Promise<CacheEntry<TResource>> {
    assertTenantId(tenantId);
    assertPlacementKey(placementKey);
    if (typeof create !== "function") {
      throw cacheError(
        "Tenant resource creation requires a callback.",
        "TENANCY_RESOURCE_CACHE_CONFIGURATION",
      );
    }

    return withGate(async () => {
      if (state !== "open") {
        throw cacheError(
          "Tenant resource cache is closing or closed.",
          "TENANCY_RESOURCE_CACHE_CLOSED",
        );
      }
      const tenantPlacement = tenantPlacements.get(tenantId);
      const existing = entries.get(placementKey);
      if (
        (tenantPlacement !== undefined && tenantPlacement !== placementKey) ||
        (existing !== undefined && existing.tenantId !== tenantId)
      ) {
        throw cacheError(
          "Tenant identity and database placement must have a one-to-one mapping.",
          "TENANCY_RESOURCE_CACHE_COLLISION",
        );
      }
      if (existing !== undefined) {
        existing.leases += 1;
        existing.lastUsed = ++clock;
        return existing;
      }

      if (entries.size >= options.capacity) {
        const idle = [...entries.values()]
          .filter((entry) => entry.leases === 0 && entry.resource !== undefined)
          .sort((left, right) => left.lastUsed - right.lastUsed)[0];
        if (idle === undefined) {
          throw cacheError(
            "Tenant resource cache capacity is exhausted by active leases.",
            "TENANCY_RESOURCE_CACHE_CAPACITY",
          );
        }
        try {
          await options.destroy(idle.resource!);
        } catch {
          throw cacheError(
            "Tenant resource eviction could not destroy an idle resource.",
            "TENANCY_RESOURCE_CACHE_DESTRUCTION",
          );
        }
        remove(idle);
      }

      const entry = {} as CacheEntry<TResource>;
      Object.assign(entry, {
        tenantId,
        placementKey,
        resource: undefined,
        failed: false,
        leases: 1,
        lastUsed: ++clock,
        creating: Promise.resolve()
          .then(create)
          .then(
            (resource) => {
              entry.resource = resource;
              return resource;
            },
            () => {
              entry.failed = true;
              throw cacheError(
                "Tenant resource creation failed.",
                "TENANCY_RESOURCE_CACHE_CREATION",
              );
            },
          ),
      } satisfies CacheEntry<TResource>);
      entries.set(placementKey, entry);
      tenantPlacements.set(tenantId, placementKey);
      return entry;
    });
  }

  async function release(entry: CacheEntry<TResource>): Promise<void> {
    await withGate(() => {
      entry.leases -= 1;
      entry.lastUsed = ++clock;
      if (entry.failed && entry.leases === 0) remove(entry);
    });
  }

  const cache: TenantResourceCache<TResource> = {
    capacity: options.capacity,
    get size() {
      return entries.size;
    },
    async lease(tenantId, placementKey, create, callback) {
      if (typeof callback !== "function") {
        throw cacheError(
          "Tenant resource lease requires a callback.",
          "TENANCY_RESOURCE_CACHE_CONFIGURATION",
        );
      }
      const entry = await acquire(tenantId, placementKey, create);
      try {
        const resource = await entry.creating;
        return await callback(resource);
      } finally {
        await release(entry);
      }
    },
    async close() {
      const creating = await withGate(() => {
        if (state === "closed") return [];
        state = "closing";
        return [...entries.values()].map((entry) => entry.creating);
      });
      await Promise.allSettled(creating);
      await withGate(async () => {
        if ([...entries.values()].some((entry) => entry.leases > 0)) {
          throw cacheError(
            "Tenant resource cache cannot close while resources are leased.",
            "TENANCY_RESOURCE_CACHE_LEASED",
          );
        }
        let failed = false;
        for (const entry of [...entries.values()]) {
          if (entry.resource === undefined) continue;
          try {
            await options.destroy(entry.resource);
            remove(entry);
          } catch {
            failed = true;
          }
        }
        if (failed) {
          throw cacheError(
            "Tenant resource cache closed with resource destruction failures.",
            "TENANCY_RESOURCE_CACHE_DESTRUCTION",
          );
        }
        entries.clear();
        tenantPlacements.clear();
        state = "closed";
      });
    },
  };
  return Object.freeze(cache);
}

function assertTenantId(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw cacheError(
      "Tenant resource cache requires a non-empty tenant identity.",
      "TENANCY_RESOURCE_CACHE_CONFIGURATION",
    );
  }
}

function assertPlacementKey(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 128 ||
    !/^[A-Za-z0-9._:-]+$/.test(value)
  ) {
    throw cacheError(
      "Database placement keys must be short opaque identifiers and must not contain credentials or URLs.",
      "TENANCY_RESOURCE_CACHE_CONFIGURATION",
    );
  }
}

function cacheError(
  message: string,
  code: TenantResourceCacheErrorCode,
): TenantResourceCacheError {
  return new TenantResourceCacheError(message, code);
}
