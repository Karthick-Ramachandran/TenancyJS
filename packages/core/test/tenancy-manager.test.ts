import { describe, expect, it, vi } from "vitest";

import {
  DuplicateBootstrapperError,
  InvalidBootstrapperError,
  InvalidTenantError,
  TenancyLifecycleError,
  TenancyManager,
  TenantContextError,
  defineConfig,
  type TenancyBootstrapper,
  type TenantExecutionContext,
  type TenantRecord,
} from "../src/index.js";

interface TestTenant extends TenantRecord {
  readonly name: string;
}

const tenantA: TestTenant = { id: "tenant-a", name: "Tenant A" };
const tenantB: TestTenant = { id: "tenant-b", name: "Tenant B" };

describe("TenancyManager context", () => {
  it("fails closed when tenant access has no active context", () => {
    const manager = new TenancyManager<TestTenant>();

    expect(manager.getContext()).toBeUndefined();
    expect(manager.getTenant()).toBeNull();
    expect(manager.isInitialized()).toBe(false);

    expectContextError(() => manager.getTenantOrFail(), "missing");
  });

  it("provides a shallow immutable tenant snapshot for one async scope", async () => {
    const manager = new TenancyManager<TestTenant>();
    const mutableTenant = { id: "tenant-a", name: "Original" };

    await manager.runWithTenant(mutableTenant, async () => {
      const context = manager.getContext();
      const tenant = manager.getTenantOrFail();

      expect(context?.mode).toBe("tenant");
      expect(tenant).toEqual(mutableTenant);
      expect(tenant).not.toBe(mutableTenant);
      expect(Object.isFrozen(context)).toBe(true);
      expect(Object.isFrozen(tenant)).toBe(true);

      mutableTenant.name = "Changed outside";
      expect(tenant.name).toBe("Original");
      expect(() => {
        (tenant as { name: string }).name = "Changed inside";
      }).toThrow(TypeError);
    });

    expect(manager.getContext()).toBeUndefined();
  });

  it("nests tenant and central scopes and restores each parent", async () => {
    const manager = new TenancyManager<TestTenant>();

    await manager.runWithTenant(tenantA, async () => {
      expect(manager.getTenantOrFail().id).toBe("tenant-a");

      await manager.runWithTenant(tenantB, async () => {
        expect(manager.getTenantOrFail().id).toBe("tenant-b");
      });
      expect(manager.getTenantOrFail().id).toBe("tenant-a");

      await manager.runInCentralContext(async () => {
        expect(manager.getContext()).toEqual({ mode: "central" });
        expect(manager.getTenant()).toBeNull();
        expect(manager.isInitialized()).toBe(true);
        expectContextError(() => manager.getTenantOrFail(), "central");

        await manager.runWithTenant(tenantB, async () => {
          expect(manager.getTenantOrFail().id).toBe("tenant-b");
        });
        expectContextError(() => manager.getTenantOrFail(), "central");
      });

      expect(manager.getTenantOrFail().id).toBe("tenant-a");
    });

    expect(manager.isInitialized()).toBe(false);
  });

  it("keeps concurrent tenant scopes isolated across async boundaries", async () => {
    const manager = new TenancyManager<TestTenant>();
    const observations = await Promise.all(
      Array.from({ length: 24 }, (_, index) => {
        const tenant = { id: `tenant-${index}`, name: `Tenant ${index}` };
        return manager.runWithTenant(tenant, async () => {
          await Promise.resolve();
          const beforeTimer = manager.getTenantOrFail().id;
          await delay(index % 3);
          const afterTimer = manager.getTenantOrFail().id;
          return [beforeTimer, afterTimer] as const;
        });
      }),
    );

    observations.forEach(([beforeTimer, afterTimer], index) => {
      expect(beforeTimer).toBe(`tenant-${index}`);
      expect(afterTimer).toBe(`tenant-${index}`);
    });
    expect(manager.getContext()).toBeUndefined();
  });

  it("rethrows the original callback error and clears the scope", async () => {
    const manager = new TenancyManager<TestTenant>();
    const failure = new Error("application failed");

    await expect(
      manager.runWithTenant(tenantA, async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(manager.getContext()).toBeUndefined();
  });

  it("rejects malformed tenant input before entering a scope", async () => {
    const manager = new TenancyManager();

    await expect(
      manager.runWithTenant({ id: " " }, async () => undefined),
    ).rejects.toBeInstanceOf(InvalidTenantError);
    await expect(
      manager.runWithTenant(
        null as unknown as TenantRecord,
        async () => undefined,
      ),
    ).rejects.toBeInstanceOf(InvalidTenantError);
    expect(manager.getContext()).toBeUndefined();
  });

  it("does not run tenant lifecycle behavior in central context", async () => {
    const bootstrap = vi.fn();
    const listener = vi.fn();
    const manager = new TenancyManager<TestTenant>({
      bootstrappers: [bootstrapper("database", bootstrap, vi.fn())],
    });
    manager.on("tenancy.initializing", listener);

    await manager.runInCentralContext(async () => {
      expect(manager.getContext()).toEqual({ mode: "central" });
    });

    expect(bootstrap).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });

  it("restores a tenant parent when a nested central callback fails", async () => {
    const manager = new TenancyManager<TestTenant>();
    const failure = new Error("central work failed");

    await manager.runWithTenant(tenantA, async () => {
      await expect(
        manager.runInCentralContext(async () => {
          throw failure;
        }),
      ).rejects.toBe(failure);
      expect(manager.getTenantOrFail().id).toBe("tenant-a");
    });
  });

  it("rejects invalid callbacks before creating a scope", async () => {
    const manager = new TenancyManager<TestTenant>();

    await expect(manager.runWithTenant(tenantA, null as never)).rejects.toThrow(
      TypeError,
    );
    await expect(manager.runInCentralContext(null as never)).rejects.toThrow(
      TypeError,
    );
    expect(manager.getContext()).toBeUndefined();
  });
});

describe("TenancyManager lifecycle", () => {
  it("runs events and bootstrappers in deterministic setup and reverse cleanup order", async () => {
    const calls: string[] = [];
    const manager = new TenancyManager<TestTenant>({
      bootstrappers: [
        recordingBootstrapper("first", calls),
        recordingBootstrapper("second", calls),
      ],
    });

    for (const event of [
      "tenancy.initializing",
      "tenancy.initialized",
      "tenancy.ending",
      "tenancy.ended",
    ] as const) {
      manager.on(event, () => {
        calls.push(event);
      });
    }

    const result = await manager.runWithTenant(tenantA, async () => {
      calls.push("callback");
      return "result";
    });

    expect(result).toBe("result");
    expect(calls).toEqual([
      "tenancy.initializing",
      "bootstrap:first:tenant-a",
      "bootstrap:second:tenant-a",
      "tenancy.initialized",
      "callback",
      "tenancy.ending",
      "revert:second:tenant-a",
      "revert:first:tenant-a",
      "tenancy.ended",
    ]);
  });

  it("reverts completed bootstrappers after a later bootstrapper fails", async () => {
    const calls: string[] = [];
    const failure = new Error("second bootstrap failed");
    const manager = new TenancyManager<TestTenant>({
      bootstrappers: [
        recordingBootstrapper("first", calls),
        bootstrapper(
          "second",
          () => {
            calls.push("bootstrap:second");
            throw failure;
          },
          () => calls.push("revert:second"),
        ),
      ],
    });
    manager.on("tenancy.ending", () => {
      calls.push("tenancy.ending");
    });
    manager.on("tenancy.ended", () => {
      calls.push("tenancy.ended");
    });
    const callback = vi.fn();

    await expect(manager.runWithTenant(tenantA, callback)).rejects.toBe(
      failure,
    );
    expect(callback).not.toHaveBeenCalled();
    expect(calls).toEqual([
      "bootstrap:first:tenant-a",
      "bootstrap:second",
      "tenancy.ending",
      "revert:first:tenant-a",
      "tenancy.ended",
    ]);
  });

  it("collects all cleanup failures without hiding the primary failure", async () => {
    const primary = new Error("callback failed");
    const secondCleanup = new Error("second cleanup failed");
    const firstCleanup = new Error("first cleanup failed");
    const endedCleanup = new Error("ended listener failed");
    const calls: string[] = [];
    const manager = new TenancyManager<TestTenant>({
      bootstrappers: [
        bootstrapper(
          "first",
          () => calls.push("bootstrap:first"),
          () => {
            calls.push("revert:first");
            throw firstCleanup;
          },
        ),
        bootstrapper(
          "second",
          () => calls.push("bootstrap:second"),
          () => {
            calls.push("revert:second");
            throw secondCleanup;
          },
        ),
      ],
    });
    manager.on("tenancy.ending", () => {
      calls.push("tenancy.ending");
    });
    manager.on("tenancy.ended", () => {
      calls.push("tenancy.ended");
      throw endedCleanup;
    });

    const error = await captureError(
      manager.runWithTenant(tenantA, async () => {
        throw primary;
      }),
    );

    expect(error).toBeInstanceOf(TenancyLifecycleError);
    expect(error).toMatchObject({
      code: "TENANCY_LIFECYCLE_FAILED",
      hasPrimaryError: true,
      primaryError: primary,
      cleanupErrors: [secondCleanup, firstCleanup, endedCleanup],
    });
    expect(calls).toEqual([
      "bootstrap:first",
      "bootstrap:second",
      "tenancy.ending",
      "revert:second",
      "revert:first",
      "tenancy.ended",
    ]);
    expect(manager.getContext()).toBeUndefined();
  });

  it("cleans up when an initialized listener rejects", async () => {
    const failure = new Error("listener failed");
    const calls: string[] = [];
    const manager = new TenancyManager<TestTenant>({
      bootstrappers: [recordingBootstrapper("database", calls)],
    });
    manager.on("tenancy.initialized", () => {
      calls.push("tenancy.initialized");
      throw failure;
    });
    const callback = vi.fn();

    await expect(manager.runWithTenant(tenantA, callback)).rejects.toBe(
      failure,
    );
    expect(callback).not.toHaveBeenCalled();
    expect(calls).toEqual([
      "bootstrap:database:tenant-a",
      "tenancy.initialized",
      "revert:database:tenant-a",
    ]);
  });

  it("continues cleanup after an ending listener rejects", async () => {
    const endingFailure = new Error("ending failed");
    const endedFailure = new Error("ended failed");
    const calls: string[] = [];
    const manager = new TenancyManager<TestTenant>({
      bootstrappers: [recordingBootstrapper("database", calls)],
    });
    manager.on("tenancy.ending", () => {
      calls.push("tenancy.ending");
      throw endingFailure;
    });
    manager.on("tenancy.ending", () => {
      calls.push("tenancy.ending:second");
    });
    manager.on("tenancy.ended", () => {
      calls.push("tenancy.ended");
    });
    manager.on("tenancy.ended", () => {
      calls.push("tenancy.ended:second");
      throw endedFailure;
    });

    const error = await captureError(
      manager.runWithTenant(tenantA, async () => "ok"),
    );

    expect(error).toBeInstanceOf(TenancyLifecycleError);
    expect(error).toMatchObject({
      hasPrimaryError: false,
      primaryError: undefined,
      cleanupErrors: [endingFailure, endedFailure],
    });
    expect(calls).toEqual([
      "bootstrap:database:tenant-a",
      "tenancy.ending",
      "tenancy.ending:second",
      "revert:database:tenant-a",
      "tenancy.ended",
      "tenancy.ended:second",
    ]);
  });

  it("supports idempotent listener unsubscribe", async () => {
    const manager = new TenancyManager<TestTenant>();
    const listener = vi.fn();
    const unsubscribe = manager.on("tenancy.initialized", listener);

    await manager.runWithTenant(tenantA, async () => undefined);
    unsubscribe();
    unsubscribe();
    await manager.runWithTenant(tenantA, async () => undefined);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("passes the correct context to shared bootstrappers under concurrency", async () => {
    const observations: string[] = [];
    const manager = new TenancyManager<TestTenant>({
      bootstrappers: [
        bootstrapper(
          "database",
          async (context) => {
            await delay(context.tenant.id === "tenant-a" ? 2 : 0);
            observations.push(`bootstrap:${context.tenant.id}`);
          },
          async (context) => {
            await Promise.resolve();
            observations.push(`revert:${context.tenant.id}`);
          },
        ),
      ],
    });

    await Promise.all([
      manager.runWithTenant(tenantA, async () => delay(1)),
      manager.runWithTenant(tenantB, async () => delay(2)),
    ]);

    expect(observations).toEqual(
      expect.arrayContaining([
        "bootstrap:tenant-a",
        "bootstrap:tenant-b",
        "revert:tenant-a",
        "revert:tenant-b",
      ]),
    );
  });

  it("validates lifecycle event registration at the runtime boundary", () => {
    const manager = new TenancyManager<TestTenant>();

    expect(() => manager.on("unknown" as never, vi.fn())).toThrow(TypeError);
    expect(() => manager.on("tenancy.initialized", null as never)).toThrow(
      TypeError,
    );
  });

  it("rejects invalid and duplicate bootstrapper registration", () => {
    expect(
      () =>
        new TenancyManager({
          bootstrappers: [
            recordingBootstrapper("duplicate", []),
            recordingBootstrapper("duplicate", []),
          ],
        }),
    ).toThrow(DuplicateBootstrapperError);

    expect(
      () =>
        new TenancyManager({
          bootstrappers: [
            {
              id: " ",
              bootstrap: () => undefined,
              revert: () => undefined,
            },
          ],
        }),
    ).toThrow(InvalidBootstrapperError);
  });
});

describe("defineConfig", () => {
  it("preserves inferred config and freezes the returned snapshot", () => {
    const input = { strategy: "databasePerTenant" as const, label: "primary" };
    const config = defineConfig(input);

    expect(config).toEqual(input);
    expect(config).not.toBe(input);
    expect(Object.isFrozen(config)).toBe(true);
  });

  it("rejects unsupported strategies at the runtime boundary", () => {
    expect(() =>
      defineConfig({ strategy: "schemaPerTenant" } as never),
    ).toThrow(TypeError);
  });
});

function recordingBootstrapper(
  id: string,
  calls: string[],
): TenancyBootstrapper<TestTenant> {
  return bootstrapper(
    id,
    (context) => calls.push(`bootstrap:${id}:${context.tenant.id}`),
    (context) => calls.push(`revert:${id}:${context.tenant.id}`),
  );
}

function bootstrapper(
  id: string,
  bootstrap: (context: TenantExecutionContext<TestTenant>) => unknown,
  revert: (context: TenantExecutionContext<TestTenant>) => unknown,
): TenancyBootstrapper<TestTenant> {
  return {
    id,
    bootstrap: async (context) => {
      await bootstrap(context);
    },
    revert: async (context) => {
      await revert(context);
    },
  };
}

function expectContextError(
  operation: () => unknown,
  reason: "missing" | "central",
): void {
  try {
    operation();
    throw new Error("Expected tenant context access to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(TenantContextError);
    expect(error).toMatchObject({
      code: "TENANCY_CONTEXT_UNAVAILABLE",
      reason,
    });
  }
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
    throw new Error("Expected promise to reject.");
  } catch (error) {
    return error;
  }
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}
