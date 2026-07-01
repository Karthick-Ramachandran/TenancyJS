# Module: Core Tenancy

## Purpose

Provide the framework- and data-layer-neutral execution model that makes tenant identity available to
application code and adapters for exactly one async scope. This is the security boundary on which all
other TenancyJS packages depend.

## Owns

- Immutable `TenantRecord` and `TenantContext` value types.
- `TenancyManager` tenant/central scope lifecycle.
- Async context propagation, nesting, and cleanup.
- Bootstrapper registration, ordered setup, reverse rollback, and lifecycle events.
- Typed configuration primitives and errors for missing/invalid context.
- Explicit central scope and explicit unsafe-bypass capability boundary.

## Does Not Own

- HTTP request parsing, response mapping, framework dependency injection, or middleware registration.
- ORM query rewriting, model hooks, connection pools, migrations, or provisioning.
- Tenant persistence, authentication, membership authorization, billing, or secret storage.
- CLI project detection, code generation, file writes, subprocesses, or terminal UI.
- Edge-runtime polyfills or a process-global current tenant.

## Public Interfaces

- `TenancyManager.runWithTenant(tenant, callback)`
- `TenancyManager.runInCentralContext(callback)`
- `TenancyManager.getContext()` / `getTenantOrFail()`
- `TenantResolver`, `TenancyBootstrapper`, and typed event/error contracts

Signatures remain proposed until ADR-0002 is accepted and T-02 starts.

## Boundaries

Core may depend only on Node.js platform APIs and small framework-neutral utilities approved through
dependency review. Integrations and adapters call core; core never imports them. Context values are
immutable. Cleanup must be lexical and exception-safe. Resolver output is identity input, not proof
of application authorization.

Relevant feature: `docs/40-features/F-001-tenancyjs-platform/`.

The package boundary is scaffolded at `packages/core/`. Its runtime export surface remains empty until
T-02.
