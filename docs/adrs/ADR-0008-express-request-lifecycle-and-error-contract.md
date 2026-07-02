# ADR-0008: Express Request Lifecycle And Error Contract

## Status

Proposed

## Context

T-05 introduces the first framework integration and must turn untrusted Express request metadata into
the accepted tenant-resolution and async-context contracts. Express middleware calls `next()`
synchronously; its return does not mean downstream asynchronous handlers, streaming, or the response
have completed. Ending `TenancyManager.runWithTenant` when `next()` returns would run bootstrap cleanup
too early, while waiting only for response `finish` would leak resources on disconnect or abort.

The integration must also decide how exhaustive resolution outcomes reach Express error handling,
whether request input can select central mode, who owns the manager/resolver, and which Express version
is supported. These choices define a public API and HTTP security boundary.

## Decision

1. Publish `@tenancyjs/integration-express` as an Express-specific package depending on
   `@tenancyjs/core` and `@tenancyjs/identifiers`, with Express as a peer dependency. The initial tested
   target is Express 5.2.x on Node 22 and Node 24.
2. Expose `createExpressTenancyMiddleware(options)` as the canonical factory. Applications supply one
   existing `TenancyManager`, a structurally typed resolution service compatible with
   `TenantResolutionChain.resolve`, and an optional `onError` hook. The integration creates no hidden
   manager, registry, adapter, or mutable global/request tenant store.
3. Adapt only request headers and host metadata into `ResolverInput`. Call the resolver exactly once.
   Only a `resolved` outcome may enter `manager.runWithTenant`; no request value or failure path may
   enter `runInCentralContext`.
4. Invoke downstream Express dispatch inside `runWithTenant` and keep its callback pending until the
   first terminal signal: response `finish`, response `close`, request `aborted`, or a synchronous
   dispatch failure. Settlement is idempotent and removes every installed listener. Check already-ended
   response state after dispatch to avoid a missed signal.
5. Return the middleware promise so Express 5 forwards asynchronous resolution/lifecycle failures.
   Downstream errors continue through normal Express error middleware; the tenancy scope remains active
   until that error response finishes or closes.
6. Map non-resolved outcomes to `ExpressTenancyResolutionError`. Missing/invalid input maps to 400;
   not-found and suspended share the same 404 status and generic message; ambiguous registry data maps
   to 500. Errors expose a stable code/reason but never raw header/host values, tenant records, lookup
   matches, or database details.
7. The default error behavior calls `next(error)`. A configured `onError(error, req, res, next)` may
   implement application response policy, but receives only the sanitized typed error and cannot
   activate central context through the integration API. Resolver/store exceptions retain their cause
   and flow to Express as server failures.
8. Stable support requires the portable integration contract, Supertest lifecycle/concurrency/error
   tests, an Express + Prisma/PostgreSQL two-tenant E2E, clean package-consumer evidence, and Node
   22/24 CI. Express 4, WebSocket upgrades, and other adapter combinations remain unclaimed.

## Alternatives Considered

- End scope immediately after `next()`: rejected because downstream asynchronous handlers outlive that
  call and bootstrap resources would be reverted before request completion.
- Clean up only on response `finish`: rejected because disconnects, destroyed responses, and request
  aborts may never emit it.
- Attach the resolved tenant to `req` or a process-global variable as the primary source: rejected
  because it creates a competing mutable context and does not protect deep async call chains.
- Create the manager and registry inside middleware: rejected because lifecycle/configuration becomes
  hidden and cannot be shared safely with adapters, jobs, or tests.
- Treat missing identity as central context: rejected because untrusted input would select privileged
  access and contradict ADR-0002/ADR-0006.
- Send opinionated JSON responses directly: rejected because host applications own response format and
  authentication/authorization policy; typed errors plus `onError` compose without hiding failures.
- Promise Express 4 and 5 support immediately: rejected because Express 4 does not provide the same
  native rejected-promise handling contract and needs a separate lane or wrapper decision.

## Consequences

Tenant context and lifecycle resources remain active for the full observable Express response and are
released on normal completion or disconnect. Resolution remains exhaustive, sanitized, and fail closed,
and applications keep ownership of authentication, authorization, registry, response policy, manager,
and adapters.

The middleware intentionally keeps one promise pending for the request lifetime and installs a small
set of listeners per request. Post-response bootstrap cleanup failures may reach Express after headers
are sent, so applications must use standard headers-sent error handling and the integration must test
that no rejection is lost. Long-lived streaming responses keep tenant lifecycle resources until close,
which is correct but must be documented. Express 4, WebSockets, and database-per-tenant connection
switching require later evidence or decisions.

## Related Documents

- PRD: `docs/00-product/PRD.md`
- Architecture: `docs/10-architecture/ARCHITECTURE.md`
- Security: `docs/20-security/SECURITY_MODEL.md`
- Feature: `docs/40-features/F-004-express-integration/`
- Module: `docs/30-modules/integration-express/`
