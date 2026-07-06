# `tenancyjs-identifiers`

Framework-neutral tenant extraction and resolution outcomes for TenancyJS.

> **New to TenancyJS? [Start with the docs →](https://tenancyjs.pages.dev/docs/getting-started/installation)** — install, the `npx tenancy` CLI, and how this package fits with an adapter + integration.

Resolvers extract identifiers from untrusted metadata. A `TenantStore` performs the registry lookup,
and `TenantResolutionChain` returns an exhaustive result without authenticating user membership or
selecting central context.

```ts
const chain = new TenantResolutionChain({
  resolvers: [
    new HeaderTenantResolver(),
    new SubdomainTenantResolver({ centralDomain: "app.example.com" }),
  ],
  store,
});

const outcome = await chain.resolve({
  host: "acme.app.example.com",
  headers: { "x-tenant-id": "tenant_acme" },
});
```

Resolver order is precedence. If a present higher-priority identifier is invalid or unknown, the
chain fails closed and does not fall through.
