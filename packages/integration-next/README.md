# tenancyjs-integration-next

Fail-closed tenant context for Next.js 16.2 App Router Route Handlers and Server Actions.

> **New to TenancyJS? [Start with the docs →](https://tenancyjs.pages.dev/docs/getting-started/installation)** — install, the `npx tenancy` CLI, and how this package fits with an adapter + integration.

## Install

```bash
pnpm add tenancyjs-core tenancyjs-identifiers tenancyjs-integration-next next
```

## Node runtime

```ts
import { TenancyManager } from "tenancyjs-core";
import {
  HeaderTenantResolver,
  TenantResolutionChain,
} from "tenancyjs-identifiers";
import { createNextTenancy } from "tenancyjs-integration-next";

const manager = new TenancyManager();
const resolver = new TenantResolutionChain({
  resolvers: [new HeaderTenantResolver()],
  store: tenantStore,
  // Verify the authenticated user belongs to the resolved tenant — resolving a
  // tenant is not authorizing it. Required (or opt out with trustResolution).
  authorize: ({ tenant, principal }) => principal.teamIds.includes(tenant.id),
});
const tenancy = createNextTenancy({
  manager,
  resolver,
  principal: async () => getSessionUser(), // read your session (Node runtime)
});

export const GET = tenancy.withRouteHandler(async () => {
  const tenant = manager.getTenantOrFail();
  return Response.json({ tenantId: tenant.id });
});
```

Wrap a Server Action with `tenancy.withServerAction(action)`. The wrapper resolves from Next's
request `headers()` in the Node runtime; it never trusts action arguments as tenant identity.

Only work awaited by the wrapped handler or action is inside tenant context. A streamed response
body executes after the Route Handler returns and must not perform tenant-scoped database work.

## Edge identity handoff

Middleware may copy normalized identity metadata with the Edge-only export:

```ts
import { NextResponse } from "next/server";
import { withNextTenantHint } from "tenancyjs-integration-next/edge";

export function middleware(request: Request) {
  return NextResponse.next({
    request: { headers: withNextTenantHint(request) },
  });
}
```

The hint is untrusted transport metadata. The Node wrapper always passes it through the configured
resolver and tenant store. A forged hint therefore cannot create a tenant context by itself.

## Security boundary

- Use only the wrapped Route Handler or Server Action for tenant-scoped work.
- Missing, invalid, unknown, suspended, and ambiguous identities fail closed with a typed,
  sanitized `NextTenancyResolutionError`.
- Unknown and suspended tenants share the same public message and status.
- Edge code does not load tenant context, registries, adapters, or database clients.
- Next cache entries must be tenant-keyed or explicitly uncached. This package does not patch Next
  cache APIs.
