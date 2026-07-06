import { TenancyManager } from "tenancyjs-core";
import {
  HeaderTenantResolver,
  TenantResolutionChain,
  type TenantResolutionOutcome,
} from "tenancyjs-identifiers";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nextHeaders = vi.hoisted(() => vi.fn());
vi.mock("next/headers.js", () => ({ headers: nextHeaders }));

import {
  NextTenancyConfigurationError,
  NextTenancyResolutionError,
  createNextTenancy,
} from "../src/index.js";
import {
  NEXT_TENANCY_HINT_HEADER,
  createNextTenantHint,
  withNextTenantHint,
} from "../src/edge.js";

interface Tenant {
  readonly id: string;
  readonly label: string;
}

const tenants = new Map<string, Tenant>([
  ["alpha", { id: "tenant-alpha", label: "Alpha" }],
  ["beta", { id: "tenant-beta", label: "Beta" }],
]);

function createFixture() {
  const manager = new TenancyManager<Tenant>();
  const resolver = new TenantResolutionChain<Tenant>({
    authorize: () => true,
    resolvers: [new HeaderTenantResolver()],
    store: {
      find: async (identifier) => {
        const tenant = tenants.get(identifier.value);
        return tenant === undefined ? [] : [{ tenant, status: "active" }];
      },
    },
  });
  return { manager, tenancy: createNextTenancy({ manager, resolver }) };
}

function deferred() {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

beforeEach(() => {
  nextHeaders.mockReset();
});

describe("createNextTenancy", () => {
  it("isolates concurrent Route Handler contexts and restores them at settlement", async () => {
    const { manager, tenancy } = createFixture();
    const release = deferred();
    const firstEntered = deferred();

    const route = tenancy.withRouteHandler(
      async (_request: Request, pause: boolean) => {
        const before = manager.getTenantOrFail().id;
        if (pause) {
          firstEntered.resolve();
          await release.promise;
        }
        await Promise.resolve();
        return [before, manager.getTenantOrFail().id] as const;
      },
    );

    const alpha = route(
      new Request("https://example.test", {
        headers: { "x-tenant-id": "alpha" },
      }),
      true,
    );
    await firstEntered.promise;
    const beta = await route(
      new Request("https://example.test", {
        headers: { "x-tenant-id": "beta" },
      }),
      false,
    );
    release.resolve();

    await expect(alpha).resolves.toEqual(["tenant-alpha", "tenant-alpha"]);
    expect(beta).toEqual(["tenant-beta", "tenant-beta"]);
    expect(manager.getTenant()).toBeNull();
  });

  it("resolves Server Actions only from Next request headers", async () => {
    const { manager, tenancy } = createFixture();
    nextHeaders.mockResolvedValue(new Headers({ "x-tenant-id": "alpha" }));
    const action = tenancy.withServerAction(
      async (untrustedTenantId: string) => ({
        argument: untrustedTenantId,
        resolved: manager.getTenantOrFail().id,
      }),
    );

    await expect(action("beta")).resolves.toEqual({
      argument: "beta",
      resolved: "tenant-alpha",
    });
    expect(nextHeaders).toHaveBeenCalledOnce();
    expect(manager.getTenant()).toBeNull();
  });

  it.each([
    [
      "no-identifier",
      { status: "no-identifier" },
      400,
      "Tenant identity is required.",
    ],
    [
      "invalid",
      { status: "invalid", resolverId: "test", reason: "invalid-value" },
      400,
      "Tenant identity is invalid.",
    ],
    [
      "not-found",
      {
        status: "not-found",
        identifier: { resolverId: "test", kind: "header", value: "secret-one" },
      },
      404,
      "Tenant was not found.",
    ],
    [
      "suspended",
      {
        status: "suspended",
        identifier: { resolverId: "test", kind: "header", value: "secret-two" },
      },
      404,
      "Tenant was not found.",
    ],
    [
      "ambiguous",
      {
        status: "ambiguous",
        identifier: {
          resolverId: "test",
          kind: "header",
          value: "secret-three",
        },
        matchCount: 2,
      },
      500,
      "Tenant resolution is unavailable.",
    ],
  ] as const)(
    "fails closed with a sanitized %s error",
    async (reason, outcome, statusCode, message) => {
      const manager = new TenancyManager<Tenant>();
      const callback = vi.fn();
      const tenancy = createNextTenancy({
        manager,
        resolver: {
          resolve: () => outcome as TenantResolutionOutcome<Tenant>,
        },
      });

      const rejection = tenancy.runWithRequest(new Headers(), callback);
      await expect(rejection).rejects.toMatchObject({
        reason,
        statusCode,
        message,
      });
      await expect(rejection).rejects.not.toHaveProperty(
        "message",
        expect.stringContaining("secret"),
      );
      expect(callback).not.toHaveBeenCalled();
      expect(manager.getTenant()).toBeNull();
    },
  );

  it("propagates resolver and callback failures without leaking context", async () => {
    const resolverError = new Error("store unavailable");
    const manager = new TenancyManager<Tenant>();
    const failingResolution = createNextTenancy({
      manager,
      resolver: {
        resolve: () => {
          throw resolverError;
        },
      },
    });
    await expect(
      failingResolution.runWithRequest(new Headers(), vi.fn()),
    ).rejects.toBe(resolverError);

    const { tenancy } = createFixture();
    const callbackError = new Error("handler failed");
    await expect(
      tenancy.runWithRequest(new Headers({ "x-tenant-id": "alpha" }), () => {
        throw callbackError;
      }),
    ).rejects.toBe(callbackError);
    expect(manager.getTenant()).toBeNull();
  });

  it("restores caller context when a Route Handler returns a stream", async () => {
    const { manager, tenancy } = createFixture();
    const contexts: Array<string | null> = [];
    const route = tenancy.withRouteHandler(() => {
      contexts.push(manager.getTenant()?.id ?? null);
      return new Response(
        new ReadableStream({
          pull(controller) {
            contexts.push(manager.getTenant()?.id ?? null);
            controller.enqueue(new TextEncoder().encode("done"));
            controller.close();
          },
        }),
      );
    });

    const response = await route(
      new Request("https://example.test", {
        headers: { "x-tenant-id": "alpha" },
      }),
    );
    expect(manager.getTenant()).toBeNull();
    await response.text();
    expect(contexts[0]).toBe("tenant-alpha");
  });

  it("rejects invalid configuration at construction and wrapping", async () => {
    expect(() => createNextTenancy(null as never)).toThrow(
      NextTenancyConfigurationError,
    );
    expect(() =>
      createNextTenancy({ manager: null as never, resolver: null as never }),
    ).toThrow("requires a TenancyManager");
    expect(() =>
      createNextTenancy({
        manager: new TenancyManager(),
        resolver: null as never,
      }),
    ).toThrow("requires a tenant resolver");

    const { tenancy } = createFixture();
    expect(() => tenancy.withRouteHandler(null as never)).toThrow(
      "Route Handler must be a function",
    );
    expect(() => tenancy.withServerAction(null as never)).toThrow(
      "Server Action must be a function",
    );
    await expect(
      tenancy.runWithRequest(new Headers(), null as never),
    ).rejects.toBeInstanceOf(NextTenancyConfigurationError);
    await expect(
      tenancy.runWithRequest(null as never, vi.fn()),
    ).rejects.toThrow("request input is required");
  });

  it("snapshots structural ResolverInput values before resolving", async () => {
    const { manager, tenancy } = createFixture();
    const source = ["alpha"];
    const execution = tenancy.runWithRequest(
      { headers: { "X-Tenant-Id": source } },
      () => manager.getTenantOrFail().id,
    );
    source[0] = "beta";
    await expect(execution).resolves.toBe("tenant-alpha");
  });
});

describe("Edge identity handoff", () => {
  it("copies only normalized identity metadata into the reserved hint", () => {
    const source = new Headers({
      authorization: "Bearer secret",
      host: "alpha.example.test",
      "x-tenant-id": "alpha",
    });
    const hint = createNextTenantHint(source);
    const forwarded = withNextTenantHint(source);

    expect(hint).not.toBeNull();
    expect(forwarded.get(NEXT_TENANCY_HINT_HEADER)).toBe(hint);
    expect(decodeURIComponent(hint!)).toBe(
      '{"v":1,"host":"alpha.example.test","tenantId":"alpha"}',
    );
    expect(decodeURIComponent(hint!)).not.toContain("secret");
  });

  it("returns no hint without supported identity and rejects oversized values", () => {
    expect(
      createNextTenantHint(new Headers({ authorization: "secret" })),
    ).toBeNull();
    expect(
      createNextTenantHint(new Headers({ "x-tenant-id": "x".repeat(3000) })),
    ).toBeNull();
  });

  it("supports Request input, host-only hints, and stale-hint removal", () => {
    const request = new Request("https://alpha.example.test", {
      headers: { host: "alpha.example.test" },
    });
    const hint = createNextTenantHint(request);
    expect(decodeURIComponent(hint!)).toBe(
      '{"v":1,"host":"alpha.example.test"}',
    );
    expect(withNextTenantHint(request).get(NEXT_TENANCY_HINT_HEADER)).toBe(
      hint,
    );

    const stale = new Headers({ [NEXT_TENANCY_HINT_HEADER]: "stale" });
    expect(withNextTenantHint(stale).has(NEXT_TENANCY_HINT_HEADER)).toBe(false);
  });

  it("revalidates a valid hint through the Node tenant store", async () => {
    const { manager, tenancy } = createFixture();
    const hinted = withNextTenantHint(
      new Headers({ "x-tenant-id": "does-not-exist" }),
    );
    hinted.delete("x-tenant-id");

    await expect(
      tenancy.runWithRequest(hinted, () => manager.getTenantOrFail().id),
    ).rejects.toMatchObject({ reason: "not-found", statusCode: 404 });
    expect(manager.getTenant()).toBeNull();
  });

  it("rejects malformed and conflicting hints before context entry", async () => {
    const { manager, tenancy } = createFixture();
    const malformed = new Headers({
      [NEXT_TENANCY_HINT_HEADER]: "not-json",
    });
    await expect(
      tenancy.runWithRequest(malformed, vi.fn()),
    ).rejects.toBeInstanceOf(NextTenancyResolutionError);

    const conflicting = withNextTenantHint(
      new Headers({ "x-tenant-id": "alpha" }),
    );
    conflicting.set("x-tenant-id", "beta");
    await expect(
      tenancy.runWithRequest(conflicting, vi.fn()),
    ).rejects.toMatchObject({ reason: "invalid" });
    expect(manager.getTenant()).toBeNull();
  });

  it.each([
    "",
    "x".repeat(2049),
    encodeURIComponent("null"),
    encodeURIComponent("[]"),
    encodeURIComponent('{"v":2,"tenantId":"alpha"}'),
    encodeURIComponent('{"v":1}'),
    encodeURIComponent('{"v":1,"host":1}'),
    encodeURIComponent('{"v":1,"tenantId":1}'),
    encodeURIComponent('{"v":1,"tenantId":""}'),
    "%not-an-encoding",
  ])("rejects an invalid encoded hint: %s", async (hint) => {
    const { tenancy } = createFixture();
    await expect(
      tenancy.runWithRequest(
        { headers: { [NEXT_TENANCY_HINT_HEADER]: hint } },
        vi.fn(),
      ),
    ).rejects.toMatchObject({ reason: "invalid" });
  });

  it("rejects multi-value hints and accepts matching original identity", async () => {
    const { manager, tenancy } = createFixture();
    await expect(
      tenancy.runWithRequest(
        { headers: { [NEXT_TENANCY_HINT_HEADER]: ["one", "two"] } },
        vi.fn(),
      ),
    ).rejects.toMatchObject({ reason: "invalid" });

    const matching = withNextTenantHint(
      new Headers({ "x-tenant-id": "alpha" }),
    );
    await expect(
      tenancy.runWithRequest(matching, () => manager.getTenantOrFail().id),
    ).resolves.toBe("tenant-alpha");
  });

  it("passes host hints through the configured Node resolver", async () => {
    const manager = new TenancyManager<Tenant>();
    const resolve = vi.fn(() => ({
      status: "resolved" as const,
      identifier: {
        resolverId: "host",
        kind: "host",
        value: "alpha.example.test",
      },
      tenant: tenants.get("alpha")!,
    }));
    const tenancy = createNextTenancy({ manager, resolver: { resolve } });
    const headers = withNextTenantHint(
      new Headers({ host: "alpha.example.test" }),
    );
    headers.delete("host");

    await tenancy.runWithRequest(headers, vi.fn());
    expect(resolve).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "alpha.example.test",
        headers: expect.objectContaining({ host: "alpha.example.test" }),
      }),
      { principal: undefined },
    );
  });
});
