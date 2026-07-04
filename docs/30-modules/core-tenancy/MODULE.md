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
- ORM-neutral `TenancyAdapter` capabilities and validation-result types.

## Does Not Own

- HTTP request parsing, response mapping, framework dependency injection, or middleware registration.
- ORM query rewriting, model hooks, connection pools, migrations, or provisioning.
- Tenant persistence, authentication, membership authorization, billing, or secret storage.
- CLI project detection, code generation, file writes, subprocesses, or terminal UI.
- Edge-runtime polyfills or a process-global current tenant.

## Public Interfaces

- `TenancyManager<TTenant>`: `runWithTenant`, `runInCentralContext`, `getContext`, `getTenant`,
  `getTenantOrFail`, `isInitialized`, and `on`.
- `TenantRecord`, `TenantContext`, `TenantExecutionContext`, and `CentralContext`.
- `TenancyBootstrapper` and typed lifecycle event/listener contracts.
- `defineConfig`, `TenancyConfig`, and `TenancyStrategy` for `rowLevel`, `schemaPerTenant`, and
  `databasePerTenant`.
- Typed `TenancyError` subclasses for context, tenant, bootstrapper, and lifecycle failures.
- `TenancyAdapter`, `TenancyAdapterCapabilities`, and adapter validation types.

## Boundaries

Core may depend only on Node.js platform APIs and small framework-neutral utilities approved through
dependency review. Integrations and adapters call core; core never imports them. Context values are
immutable. Cleanup must be lexical and exception-safe. Resolver output is identity input, not proof
of application authorization.

Relevant feature: `docs/40-features/F-001-tenancyjs-platform/`.

The implementation lives in `packages/core/src/`; lifecycle behavior is fixed by ADR-0005 and the
adapter vocabulary by ADR-0007. Core owns only data-only adapter contracts, not ORM behavior. No
unsafe bypass API is exposed beyond explicit lexical central context.
