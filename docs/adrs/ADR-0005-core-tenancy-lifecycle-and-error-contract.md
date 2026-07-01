# ADR-0005: Core Tenancy Lifecycle And Error Contract

## Status

Accepted

## Context

T-02 turns the accepted async-context architecture into the first public runtime API. Framework
integrations and data-layer adapters will depend on its tenant shape, scope semantics, bootstrapper
contract, event ordering, and error behavior. An imperative initialize/end API or globally mutable
bootstrap state would be easy to misuse under concurrent requests.

## Decision

Expose a generic `TenancyManager<TTenant extends TenantRecord>` backed by Node.js
`AsyncLocalStorage`. The public execution API is lexical only:

- `runWithTenant(tenant, callback)` creates an immutable tenant snapshot for one async scope;
- `runInCentralContext(callback)` creates an explicit central scope;
- `getContext`, `getTenant`, `getTenantOrFail`, and `isInitialized` inspect the current scope.

`TenantContext` is a discriminated union of tenant and central modes. `TenantRecord` requires only a
non-empty string `id`, allowing applications to extend it without core owning persistence fields.
Tenant snapshots are shallow-cloned and frozen; nested custom values remain the application's
responsibility.

Bootstrappers are registered when the manager is constructed. Each completed `bootstrap` receives the
same immutable tenant context and is reverted in reverse registration order. Revert continues after
individual failures. Lifecycle listeners run sequentially from a snapshot in this order on success:
`tenancy.initializing`, `tenancy.initialized`, `tenancy.ending`, `tenancy.ended`.

Missing and central-mode tenant access throw a typed `TenantContextError`. Invalid tenant input and
duplicate bootstrapper IDs have dedicated typed errors. If cleanup fails, `TenancyLifecycleError`
contains the primary error, when present, plus every cleanup/listener error. If cleanup succeeds, an
original callback or initialization error is rethrown unchanged.

## Alternatives Considered

- Public `initialize()` and `end()`: familiar from Laravel-inspired APIs, but lexical pairing cannot be
  enforced and concurrent async callers can end the wrong scope.
- Framework request-scoped containers: not portable to jobs, scripts, Next.js, or raw Express.
- A fixed, feature-rich tenant model: couples core to registry, provisioning, and secret-bearing fields.
- Deep-freezing arbitrary tenant objects: unsafe for dates, maps, class instances, and application-owned
  nested values; a documented shallow immutable snapshot is predictable.
- Stop cleanup on the first revert error: leaks resources owned by later completed bootstrappers.
- Always wrap callback failures: destroys error identity even when lifecycle cleanup succeeded.

## Consequences

Callers cannot forget a matching `end`, parent scopes restore automatically, and one manager works for
HTTP handlers, jobs, tests, and scripts. Adapters get a small fail-closed inspection API. Cleanup
failure evidence is complete and deterministic. The manager is Node-runtime-only, listener and
bootstrapper order becomes public behavior, and applications must not assume deep immutability of
custom nested tenant metadata. Database connection switching must remain context-local rather than
mutating a process-global client.

## Related Documents

- PRD: `docs/00-product/PRD.md`
- Architecture: `docs/10-architecture/ARCHITECTURE.md`
- Security: `docs/20-security/SECURITY_MODEL.md`
- Feature: `docs/40-features/F-001-tenancyjs-platform/ACCEPTANCE.md`
- Module: `docs/30-modules/core-tenancy/MODULE.md`
