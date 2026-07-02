# ADR-0009: Nextjs Node Execution And Edge Identity Handoff

## Status

Accepted

## Context

T-07 introduces App Router Route Handler and Server Action integration across two materially different
runtimes. Tenant database work requires the Node runtime and `TenancyManager`; Next middleware may run
at the Edge, where database adapters and Node async context are unavailable. Request headers and
middleware-produced hints are attacker-controlled unless Node resolution validates them.

The package must define wrapper APIs, error behavior, streaming/caching limits, and whether Edge
middleware can establish trusted tenant context.

## Decision

1. Publish `@tenancyjs/integration-next` for Next.js 16.2.x on Node 22/24. It depends on core and
   identifiers, uses Next as a peer, and imports no adapter.
2. Expose `createNextTenancy(options)` returning `withRouteHandler`, `withServerAction`, and
   `runWithRequest` helpers over one application-owned manager and resolver.
3. Route Handlers resolve from a frozen snapshot of request headers/host, enter `runWithTenant` only
   for `resolved`, await the handler, and clean up when the handler promise settles. Streaming body
   callbacks execute outside the guarantee and must not perform tenant database access.
4. Server Actions resolve inside the Node invocation from Next `headers()` unless the application
   supplies an explicit `ResolverInput`; they never accept a tenant record or central-mode flag from
   action arguments.
5. Provide an Edge-safe identity-hint helper that copies only normalized identifier metadata into a
   reserved request header. The hint is untrusted: Node always validates it through the configured
   resolver/store before context or database access. The package does not sign, authenticate, query a
   registry, open a database, or use `TenancyManager` in Edge middleware.
6. Resolution failures use typed sanitized errors and optional application mapping. Unknown and
   suspended identities remain externally indistinguishable; no raw header, tenant, or database value
   appears in default output.
7. Wrapped tenant execution is dynamic and must not be placed behind shared cross-tenant caches.
   Documentation requires tenant-varying cache keys or `no-store`; the integration does not monkey-patch
   Next caching APIs.
8. Stable support requires production build/start E2E for Route Handlers and Server Actions, concurrent
   tenants, forged hints, error cleanup, cache boundaries, Prisma/PostgreSQL isolation, and Node 22/24 CI.

## Alternatives Considered

- Resolve tenants or open Prisma in Edge middleware: rejected because runtime capabilities and secret
  handling cannot support the accepted Node database boundary.
- Trust a middleware-set header: rejected because clients and proxies can forge headers.
- Accept tenant IDs as Server Action arguments: rejected because action input is attacker-controlled.
- Promise context during streamed response consumption: rejected because the lexical handler has
  returned and lifecycle resources must be released.
- Automatically patch every Next cache call: rejected because cache ownership is application-specific
  and hidden rewriting would create false isolation guarantees.

## Consequences

Route Handlers and Server Actions reuse the same fail-closed Node context and resolver contracts as
Express without pretending Edge middleware is a database runtime. Forged hints remain ordinary
untrusted identifiers. The cost is explicit dynamic/caching guidance, no database work in streamed
body callbacks, and no universal Edge tenant lookup. Applications still own authentication,
membership authorization, cache keys, and optional signed-hint infrastructure.

## Related Documents

- PRD: `docs/40-features/F-006-nextjs-integration/PRD.md`
- Architecture: `docs/10-architecture/ARCHITECTURE.md`
- Security: `docs/20-security/SECURITY_MODEL.md`
- Feature: `docs/40-features/F-006-nextjs-integration/`
- Module: `docs/30-modules/integration-next/`
