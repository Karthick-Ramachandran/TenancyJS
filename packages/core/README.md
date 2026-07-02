# `@tenancyjs/core`

Framework-neutral tenant context and lifecycle primitives for TenancyJS.

> Pre-alpha: implemented in the monorepo but not published for production use.

## Core guarantees

- Tenant identity is scoped with Node.js `AsyncLocalStorage`, never process-global mutable state.
- Missing tenant context fails with a typed `TenantContextError`.
- Central execution is explicit and lexical.
- Nested and concurrent scopes restore their parent automatically.
- Bootstrappers set up in registration order and revert in reverse order.
- Cleanup continues after failures and reports every cleanup error.

## Usage

```ts
import { TenancyManager, type TenantRecord } from "@tenancyjs/core";

interface Tenant extends TenantRecord {
  readonly slug: string;
}

const tenancy = new TenancyManager<Tenant>();

await tenancy.runWithTenant({ id: "tenant_123", slug: "acme" }, async () => {
  const tenant = tenancy.getTenantOrFail();
  console.log(tenant.id);
});
```

`runWithTenant` makes a shallow clone and freezes the tenant record. Custom nested values are not
deep-frozen and remain the application's responsibility.

## Explicit central context

```ts
await tenancy.runInCentralContext(async () => {
  // Central work is explicit. getTenantOrFail() throws with reason "central" here.
});
```

Resolver failure never enters central mode. Framework integrations must decide whether a route is
central before calling this API.

## Bootstrappers and events

Bootstrappers are fixed when the manager is created:

```ts
const tenancy = new TenancyManager({
  bootstrappers: [
    {
      id: "database",
      async bootstrap(context) {
        // Prepare context-local resources for context.tenant.
      },
      async revert(context) {
        // Release only resources owned by this execution scope.
      },
    },
  ],
});
```

Successful lifecycle order:

```txt
tenancy.initializing
bootstrap (registration order)
tenancy.initialized
application callback
tenancy.ending
revert (reverse order)
tenancy.ended
```

Subscribe with `tenancy.on(event, listener)`. The returned function unsubscribes idempotently.

## Isolation strategies

`defineConfig` accepts the two committed strategies:

```ts
import { defineConfig } from "@tenancyjs/core";

export default defineConfig({
  strategy: "rowLevel", // or "databasePerTenant"
});
```

Core carries strategy intent; adapters and later provisioning modules implement the actual database
isolation behavior.

## Adapter contract

`TenancyAdapter`, `TenancyAdapterCapabilities`, and validation-result types provide the small,
ORM-neutral vocabulary used by adapter packages. Core does not import an ORM or implement query
rewriting.

## Errors

- `TenantContextError`: tenant access was attempted with no scope or in central mode.
- `InvalidTenantError`: a tenant does not contain a non-empty string `id`.
- `InvalidBootstrapperError` / `DuplicateBootstrapperError`: invalid manager configuration.
- `TenancyLifecycleError`: cleanup failed; inspect `primaryError`, `hasPrimaryError`, and
  `cleanupErrors`.
