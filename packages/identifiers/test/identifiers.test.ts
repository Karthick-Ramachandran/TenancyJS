import { describe, expect, it, vi } from "vitest";

import type { TenantRecord } from "tenancyjs-core";

import {
  HeaderTenantResolver,
  HostTenantResolver,
  IdentifierConfigurationError,
  SubdomainTenantResolver,
  TenantResolutionChain,
  TenantResolutionError,
  normalizeHost,
  normalizeHostValues,
  normalizeIdentifierValues,
  type TenantLookupMatch,
  type TenantResolver,
  type TenantStore,
} from "../src/index.js";

interface TestTenant extends TenantRecord {
  readonly name: string;
}

const tenantA: TestTenant = { id: "tenant-a", name: "Tenant A" };

describe("identifier normalization", () => {
  it("normalizes safe tenant identifier values", () => {
    expect(normalizeIdentifierValues([" tenant-a "])).toEqual({
      status: "value",
      value: "tenant-a",
    });
    expect(normalizeIdentifierValues(["tenant-a", ["tenant-a"]])).toEqual({
      status: "value",
      value: "tenant-a",
    });
    expect(normalizeIdentifierValues([undefined])).toEqual({
      status: "missing",
    });
  });

  it.each([
    [[""], "empty-value"],
    [["tenant a"], "invalid-value"],
    [["tenant/a"], "invalid-value"],
    [[`tenant-${"a".repeat(250)}`], "invalid-value"],
    [["tenant-a", "tenant-b"], "multiple-values"],
  ] as const)("rejects unsafe identifier values %#", (values, reason) => {
    expect(normalizeIdentifierValues(values)).toEqual({
      status: "invalid",
      reason,
    });
  });

  it.each([
    ["Acme.Example.COM", "acme.example.com"],
    ["acme.example.com.", "acme.example.com"],
    ["acme.example.com:443", "acme.example.com"],
    ["localhost:3000", "localhost"],
    ["127.0.0.1:8080", "127.0.0.1"],
  ])("normalizes host %s", (input, expected) => {
    expect(normalizeHost(input)).toBe(expected);
  });

  it.each([
    "",
    "https://acme.example.com",
    "user@acme.example.com",
    "acme.example.com/path",
    "acme example.com",
    "-acme.example.com",
    "acme-.example.com",
    "acme..example.com",
    "acme.example.com:70000",
    "acme.example.com:abc",
    "[::1]:3000",
    "münich.example.com",
  ])("rejects unsafe host %s", (input) => {
    expect(normalizeHost(input)).toBeNull();
  });

  it("rejects conflicting host sources after normalization", () => {
    expect(normalizeHostValues(["a.example.com", ["b.example.com"]])).toEqual({
      status: "invalid",
      reason: "multiple-values",
    });
    expect(normalizeHostValues([undefined])).toEqual({ status: "missing" });
  });

  it("satisfies deterministic host normalization invariants for generated strings", () => {
    const next = seededGenerator(0x51f15e);
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789-. :/@?#\\\u0000";

    for (let sample = 0; sample < 500; sample += 1) {
      const length = Math.floor(next() * 40);
      let input = "";
      for (let index = 0; index < length; index += 1) {
        input += alphabet[Math.floor(next() * alphabet.length)];
      }
      const normalized = normalizeHost(input);
      if (normalized !== null) {
        expect(normalizeHost(normalized)).toBe(normalized);
        expect(normalized).toBe(normalized.toLowerCase());
        expect(normalized).not.toMatch(/[\s/@?#\\]/);
      }
    }
  });
});

describe("built-in resolvers", () => {
  it("reads header names case-insensitively and rejects conflicts", () => {
    const resolver = new HeaderTenantResolver();

    expect(
      resolver.resolve({ headers: { "X-Tenant-ID": "tenant-a" } }),
    ).toMatchObject({
      status: "candidate",
      identifier: { kind: "header", value: "tenant-a" },
    });
    expect(
      resolver.resolve({
        headers: { "x-tenant-id": "tenant-a", "X-Tenant-Id": "tenant-b" },
      }),
    ).toEqual({
      status: "invalid",
      resolverId: "header:x-tenant-id",
      reason: "multiple-values",
    });
    expect(resolver.resolve({ headers: {} })).toEqual({ status: "no-match" });
  });

  it("resolves full hosts and excludes configured central domains", () => {
    const resolver = new HostTenantResolver({
      centralDomains: ["app.example.com"],
    });

    expect(resolver.resolve({ host: "tenant.example.com:443" })).toMatchObject({
      status: "candidate",
      identifier: { kind: "host", value: "tenant.example.com" },
    });
    expect(resolver.resolve({ host: "app.example.com" })).toEqual({
      status: "no-match",
    });
    expect(resolver.resolve({ host: "https://evil.example" })).toMatchObject({
      status: "invalid",
      reason: "invalid-host",
    });
  });

  it("extracts exactly one immediate subdomain", () => {
    const resolver = new SubdomainTenantResolver({
      centralDomain: "app.example.com",
    });

    expect(resolver.resolve({ host: "acme.app.example.com" })).toMatchObject({
      status: "candidate",
      identifier: { kind: "subdomain", value: "acme" },
    });
    expect(resolver.resolve({ host: "app.example.com" })).toEqual({
      status: "no-match",
    });
    expect(
      resolver.resolve({ host: "deep.acme.app.example.com" }),
    ).toMatchObject({
      status: "invalid",
      reason: "invalid-host",
    });
    expect(resolver.resolve({ host: "other.example.com" })).toEqual({
      status: "no-match",
    });
  });

  it("rejects unsafe resolver configuration", () => {
    expect(
      () => new HeaderTenantResolver({ headerName: "bad header" }),
    ).toThrow(IdentifierConfigurationError);
    expect(() => new HeaderTenantResolver({ id: " " })).toThrow(
      IdentifierConfigurationError,
    );
    expect(
      () => new HostTenantResolver({ centralDomains: ["https://example.com"] }),
    ).toThrow(IdentifierConfigurationError);
    expect(() => new SubdomainTenantResolver(null as never)).toThrow(
      IdentifierConfigurationError,
    );
  });
});

describe("TenantResolutionChain", () => {
  it.each([
    [[], "not-found"],
    [
      [
        { tenant: tenantA, status: "active" },
        { tenant: { id: "tenant-b", name: "Tenant B" }, status: "active" },
      ],
      "ambiguous",
    ],
    [[{ tenant: tenantA, status: "suspended" }], "suspended"],
    [[{ tenant: tenantA, status: "active" }], "resolved"],
  ] as const)(
    "maps store matches to %s outcome %#",
    async (matches, status) => {
      const chain = chainWithMatches(matches);
      const outcome = await chain.resolve({
        headers: { "x-tenant-id": "tenant-a" },
      });

      expect(outcome.status).toBe(status);
      if (outcome.status === "resolved") {
        expect(outcome.tenant).toEqual(tenantA);
        expect(outcome.tenant).not.toBe(tenantA);
        expect(Object.isFrozen(outcome.tenant)).toBe(true);
      }
      if (outcome.status === "ambiguous") {
        expect(outcome.matchCount).toBe(2);
        expect(outcome).not.toHaveProperty("tenants");
      }
    },
  );

  it("uses explicit precedence and never falls through after an unknown header", async () => {
    const store: TenantStore<TestTenant> = { find: vi.fn(async () => []) };
    const host = new HostTenantResolver();
    const hostResolve = vi.spyOn(host, "resolve");
    const chain = new TenantResolutionChain({
      resolvers: [new HeaderTenantResolver(), host],
      store,
    });

    const outcome = await chain.resolve({
      host: "acme.example.com",
      headers: { "x-tenant-id": "unknown" },
    });

    expect(outcome.status).toBe("not-found");
    expect(hostResolve).not.toHaveBeenCalled();
  });

  it("returns no-identifier when every resolver has no match", async () => {
    const store = { find: vi.fn() };
    const chain = new TenantResolutionChain({
      resolvers: [new HeaderTenantResolver(), new HostTenantResolver()],
      store,
    });

    await expect(chain.resolve({})).resolves.toEqual({
      status: "no-identifier",
    });
    expect(store.find).not.toHaveBeenCalled();
  });

  it("wraps resolver and store failures without exposing fallback", async () => {
    const resolverFailure = new Error("resolver failed");
    const resolver: TenantResolver = {
      id: "custom",
      resolve: () => {
        throw resolverFailure;
      },
    };
    const chain = new TenantResolutionChain({
      resolvers: [resolver],
      store: { find: vi.fn() },
    });
    await expect(chain.resolve({})).rejects.toMatchObject({
      code: "TENANCY_RESOLUTION_FAILED",
      sourceId: "custom",
      cause: resolverFailure,
    });

    const storeFailure = new Error("store failed");
    const storeChain = new TenantResolutionChain({
      resolvers: [new HeaderTenantResolver()],
      store: {
        find: () => {
          throw storeFailure;
        },
      },
    });
    await expect(
      storeChain.resolve({ headers: { "x-tenant-id": "tenant-a" } }),
    ).rejects.toMatchObject({
      code: "TENANCY_RESOLUTION_FAILED",
      sourceId: "tenant-store",
      cause: storeFailure,
    });
  });

  it("validates custom resolver output and stamps the configured resolver id", async () => {
    const find = vi.fn(async () => [
      { tenant: tenantA, status: "active" as const },
    ]);
    const chain = new TenantResolutionChain({
      resolvers: [
        {
          id: "custom",
          resolve: () => ({
            status: "candidate" as const,
            identifier: {
              resolverId: "spoofed",
              kind: "header",
              value: "tenant-a",
            },
          }),
        },
      ],
      store: { find },
    });

    await expect(chain.resolve({})).resolves.toMatchObject({
      status: "resolved",
      identifier: { resolverId: "custom" },
    });
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ resolverId: "custom" }),
    );

    const invalid = new TenantResolutionChain({
      resolvers: [
        {
          id: "invalid-custom",
          resolve: () => ({ status: "invalid", reason: "invented" }) as never,
        },
      ],
      store: { find: vi.fn() },
    });
    await expect(invalid.resolve({})).rejects.toMatchObject({
      code: "TENANCY_RESOLUTION_FAILED",
      sourceId: "invalid-custom",
    });

    const invalidCandidate = new TenantResolutionChain({
      resolvers: [
        {
          id: "candidate-custom",
          resolve: () =>
            ({
              status: "candidate",
              identifier: { kind: "header", value: "tenant\nadmin" },
            }) as never,
        },
      ],
      store: { find: vi.fn() },
    });
    await expect(invalidCandidate.resolve({})).rejects.toMatchObject({
      sourceId: "candidate-custom",
    });
  });

  it("rejects invalid chain configuration and store output", async () => {
    expect(
      () =>
        new TenantResolutionChain({ resolvers: [], store: { find: vi.fn() } }),
    ).toThrow(IdentifierConfigurationError);
    expect(
      () =>
        new TenantResolutionChain({
          resolvers: [null as never],
          store: { find: vi.fn() },
        }),
    ).toThrow(IdentifierConfigurationError);
    expect(
      () =>
        new TenantResolutionChain({
          resolvers: [new HeaderTenantResolver(), new HeaderTenantResolver()],
          store: { find: vi.fn() },
        }),
    ).toThrow(IdentifierConfigurationError);

    const chain = new TenantResolutionChain({
      resolvers: [new HeaderTenantResolver()],
      store: { find: async () => [{ tenant: { id: "" }, status: "active" }] },
    });
    await expect(
      chain.resolve({ headers: { "x-tenant-id": "tenant-a" } }),
    ).rejects.toBeInstanceOf(TenantResolutionError);

    const nonArrayStore = new TenantResolutionChain({
      resolvers: [new HeaderTenantResolver()],
      store: { find: async () => null as never },
    });
    await expect(
      nonArrayStore.resolve({ headers: { "x-tenant-id": "tenant-a" } }),
    ).rejects.toBeInstanceOf(TenantResolutionError);
  });
});

function chainWithMatches(
  matches: readonly TenantLookupMatch<TestTenant>[],
): TenantResolutionChain<TestTenant> {
  return new TenantResolutionChain({
    resolvers: [new HeaderTenantResolver()],
    store: { find: async () => matches },
  });
}

function seededGenerator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}
