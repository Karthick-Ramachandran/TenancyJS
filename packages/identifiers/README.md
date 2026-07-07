# `tenancyjs-identifiers`

Framework-neutral tenant extraction and resolution outcomes for TenancyJS.

> **New to TenancyJS? [Start with the docs →](https://tenancyjs.pages.dev/docs/getting-started/installation)** — install, the `tenancyjs-cli` CLI, and how this package fits with an adapter + integration.

Resolvers extract identifiers from untrusted request metadata. A `TenantStore` does the registry lookup,
and `TenantResolutionChain` returns an exhaustive, fail-closed outcome. Resolving proves a tenant
_exists_ — it never proves the user may _act as_ it, so the chain **requires** you to decide membership:
pass an `authorize` hook, or opt out with `trustResolution` for a source you trust.

```ts
const chain = new TenantResolutionChain({
  resolvers: [
    new HeaderTenantResolver(),
    new SubdomainTenantResolver({ centralDomain: "app.example.com" }),
  ],
  store,
  // Verify the authenticated principal may act as the resolved tenant.
  authorize: ({ tenant, principal }) => principal.teamIds.includes(tenant.id),
});

const outcome = await chain.resolve(
  { host: "acme.app.example.com", headers: { "x-tenant-id": "tenant_acme" } },
  { principal: currentUser },
);
```

A raw header is spoofable, so `trustResolution` cannot be combined with a header/host resolver — it must
go through `authorize`. Resolver order is precedence; a present higher-priority identifier that is
invalid or unknown fails closed and never falls through.
