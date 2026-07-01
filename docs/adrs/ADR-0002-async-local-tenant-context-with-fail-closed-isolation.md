# ADR-0002: Async Local Tenant Context With Fail Closed Isolation

## Status

Accepted

## Context

Framework requests, server actions, jobs, tests, and transactions need tenant identity without passing
it through every function. A process-global tenant is unsafe under concurrency, while optional or
silently missing context creates cross-tenant leak risk. Central work also needs an explicit scope.

## Decision

Use Node.js async context propagation behind `TenancyManager` to hold an immutable discriminated
execution context: tenant or central. Tenant-aware adapters fail with a typed error when no context is
present; strict mode is the default and stable integrations cannot disable it implicitly.

`runWithTenant` and `runInCentralContext` are lexical, nestable operations. Bootstrappers set up in
order and revert completed setup in reverse order in `finally`. Resolver failure remains a resolution
failure and never becomes central mode. Unsafe bypass, where an adapter genuinely requires it, is an
explicit audited capability outside request-controlled selection.

## Alternatives Considered

- Pass `tenantId` through every repository call: explicit but invasive and still easy to omit.
- Request-scoped framework containers: unavailable in framework-neutral code and awkward for jobs,
  scripts, and cross-framework tests.
- Process-global mutable state: rejected because concurrent requests overwrite one another.
- Default to unscoped/central access when context is absent: rejected because failures expose data.

## Consequences

The API works across supported Node frameworks and gives adapters one consistent source of context.
Concurrency and cleanup become testable. The runtime is Node-specific; Edge runtimes require a
separate identity handoff into Node execution. Async-resource edge cases and consumer-created clients
remain risks, so concurrency tests and explicit adapter registration are mandatory.

## Related Documents

- PRD: `docs/00-product/PRD.md`
- Architecture: `docs/10-architecture/ARCHITECTURE.md`
- Security: `docs/20-security/SECURITY_MODEL.md`
- Feature: `docs/40-features/F-001-tenancyjs-platform/ACCEPTANCE.md`
