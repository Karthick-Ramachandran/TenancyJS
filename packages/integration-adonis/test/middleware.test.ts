import { TenancyManager } from "tenancyjs-core";
import type { TenantResolutionOutcome } from "tenancyjs-identifiers";
import { describe, expect, it } from "vitest";

import {
  AdonisTenancyResolutionError,
  TenancyMiddleware,
  defineAdonisTenancyConfig,
} from "../src/index.js";
import type { AdonisTenancyErrorHandler } from "../src/index.js";
import {
  countingResolver,
  fakeContext,
  identifier,
  nextSpy,
  recordingTenancy,
  resolvedOutcome,
  type TestTenant,
} from "./support.js";

function build(
  outcome: TenantResolutionOutcome<TestTenant>,
  onError?: AdonisTenancyErrorHandler,
) {
  const manager = new TenancyManager<TestTenant>();
  const resolver = countingResolver(outcome);
  const tenancy = recordingTenancy();
  const config = defineAdonisTenancyConfig({
    manager,
    resolver,
    tenancy,
    ...(onError ? { onError } : {}),
  });
  return {
    manager,
    resolver,
    tenancy,
    middleware: new TenancyMiddleware(config),
  };
}

function tenantId(manager: TenancyManager<TestTenant>): string | undefined {
  const context = manager.getContext();
  return context?.mode === "tenant" ? context.tenant.id : undefined;
}

describe("TenancyMiddleware", () => {
  it("resolves once and runs next inside tenant context and the Lucid transaction", async () => {
    const { manager, resolver, tenancy, middleware } = build(
      resolvedOutcome({ id: "tenant-a", name: "A" }),
    );
    let seen: string | undefined;
    const next = nextSpy(() => {
      tenancy.events.push("next");
      seen = tenantId(manager);
    });

    await middleware.handle(fakeContext(), next);

    expect(resolver.calls).toBe(1);
    expect(next.calls).toBe(1);
    expect(seen).toBe("tenant-a");
    expect(tenancy.events).toEqual(["run:start", "next", "run:commit"]);
    expect(manager.getContext()).toBeUndefined();
  });

  it("isolates concurrent requests", async () => {
    const manager = new TenancyManager<TestTenant>();
    const tenancy = recordingTenancy();
    const seen: Record<string, string | undefined> = {};
    const run = (id: string) => {
      const config = defineAdonisTenancyConfig({
        manager,
        resolver: countingResolver(resolvedOutcome({ id, name: id })),
        tenancy,
      });
      return new TenancyMiddleware(config).handle(
        fakeContext(),
        nextSpy(async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          seen[id] = tenantId(manager);
        }),
      );
    };

    await Promise.all([run("tenant-a"), run("tenant-b")]);

    expect(seen).toEqual({ "tenant-a": "tenant-a", "tenant-b": "tenant-b" });
  });

  it.each<[TenantResolutionOutcome<TestTenant>, string, 400 | 404 | 500]>([
    [{ status: "no-identifier" }, "no-identifier", 400],
    [
      { status: "invalid", resolverId: "header", reason: "invalid-value" },
      "invalid",
      400,
    ],
    [{ status: "not-found", identifier }, "not-found", 404],
    [{ status: "suspended", identifier }, "suspended", 404],
    [{ status: "ambiguous", identifier, matchCount: 2 }, "ambiguous", 500],
  ])(
    "maps %o safely without entering tenant scope",
    async (outcome, reason, status) => {
      const errors: AdonisTenancyResolutionError[] = [];
      const { tenancy, middleware } = build(outcome, (error) => {
        errors.push(error);
      });
      const next = nextSpy();

      await middleware.handle(fakeContext(), next);

      expect(next.calls).toBe(0);
      expect(tenancy.events).toEqual([]);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(AdonisTenancyResolutionError);
      expect(errors[0]!.reason).toBe(reason);
      expect(errors[0]!.status).toBe(status);
    },
  );

  it("rejects with the sanitized error when no custom handler is configured", async () => {
    const { middleware } = build({ status: "no-identifier" });
    await expect(
      middleware.handle(fakeContext(), nextSpy()),
    ).rejects.toBeInstanceOf(AdonisTenancyResolutionError);
  });

  it("rolls back and rethrows when the handler fails", async () => {
    const { tenancy, middleware } = build(
      resolvedOutcome({ id: "tenant-a", name: "A" }),
    );
    const failure = new Error("handler failed");

    await expect(
      middleware.handle(
        fakeContext(),
        nextSpy(() => {
          throw failure;
        }),
      ),
    ).rejects.toBe(failure);
    expect(tenancy.events).toEqual(["run:start", "run:rollback"]);
  });

  it("snapshots host and headers into the resolver input", async () => {
    const { resolver, middleware } = build(
      resolvedOutcome({ id: "tenant-a", name: "A" }),
    );

    await middleware.handle(
      fakeContext({
        host: "tenant-a.example.com",
        headers: { "x-tenant-id": "tenant-a", "x-multi": ["a", "b"] },
      }),
      nextSpy(),
    );

    expect(resolver.lastInput?.host).toBe("tenant-a.example.com");
    expect(resolver.lastInput?.headers?.["x-tenant-id"]).toBe("tenant-a");
    expect(resolver.lastInput?.headers?.["x-multi"]).toEqual(["a", "b"]);
    expect(Object.isFrozen(resolver.lastInput)).toBe(true);
    expect(Object.isFrozen(resolver.lastInput?.headers)).toBe(true);
  });
});
