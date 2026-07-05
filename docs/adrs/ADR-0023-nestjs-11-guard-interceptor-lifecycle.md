# ADR-0023: NestJS 11 Guard And Interceptor Lifecycle

## Status

Accepted

## Context

NestJS 11 is a launch requirement. Its guards run before interceptors, while interceptors own the
controller Observable lifetime. A single guard cannot keep `AsyncLocalStorage` open after it returns,
and a single interceptor establishes tenant context too late for authorization guards. The integration
must support both Nest's Express and Fastify platforms without importing either adapter.

## Decision

1. Publish `tenancyjs-integration-nest` for NestJS `>=11 <12` and Node `>=24`.
2. `TenancyModule.forRoot(options)` registers a global tenant-resolution guard, context interceptor,
   and a singleton request-resolution service. `@TenantRoute()` explicitly marks tenant controllers or
   handlers; unmarked routes are not silently treated as tenant or central routes.
3. The guard snapshots structural request headers/host, resolves exactly once, maps non-resolved
   outcomes through the shared identifiers HTTP decision, and stores the frozen tenant in a private
   `WeakMap` keyed by request. It never enters central context.
4. Later authorization guards may read the resolved tenant through the injected resolution service,
   but the canonical `TenancyManager` context begins in the interceptor.
5. The interceptor consumes and deletes the request mapping, then keeps `runWithTenant` and an optional
   callback-scoped ORM executor active until the handler Observable completes, errors, or is cancelled.
6. The integration exposes no raw ORM client, credentials, hidden manager, registry, or mutable global.
   Exception filters run after an errored interceptor and therefore must not require tenant DB context.
7. Stable support requires lifecycle/cancellation/concurrency tests for Express and Fastify Nest apps,
   plus a real-database Nest + adapter adversarial test.

## Alternatives Considered

- Interceptor only: rejected because authorization guards run first.
- Guard only or `AsyncLocalStorage.enterWith`: rejected because guard completion is not request
  completion and imperative context can bleed into unrelated work.
- Express middleware reuse: rejected as the only contract because Nest also supports Fastify and has
  its own guard/interceptor ordering.
- Request-scoped providers for all tenancy services: rejected due overhead and hidden duplicate state.

## Consequences

Nest receives a native, testable lifecycle with one resolver call and no framework-platform lock-in.
The split guard/interceptor contract is more ceremony than middleware, guard ordering must remain
documented, and exception filters intentionally execute after tenant DB scope cleanup.

## Related Documents

- PRD: `docs/40-features/F-010-nest-typeorm-sequelize/PRD.md`
- Architecture: `docs/10-architecture/ARCHITECTURE.md`
- Security: `docs/20-security/SECURITY_MODEL.md`
- Feature: `docs/40-features/F-010-nest-typeorm-sequelize/`
