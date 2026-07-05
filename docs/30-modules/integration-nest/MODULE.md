# Module: Integration Nest

## Purpose

Provide NestJS 11-native tenant resolution and Observable lifecycle composition without duplicating
tenant state or depending on Express/Fastify internals.

## Owns

- `@TenantRoute` metadata, resolution guard/store, context interceptor, dynamic module/config, typed
  sanitized errors, and Nest test helpers.

## Does Not Own

- Tenant storage, registry/auth policy, ORM implementation, central-route inference, credentials, or
  framework platform adapters.

## Public Interfaces

- `TenancyModule.forRoot`, `TenantRoute`, `TenantResolutionGuard`, `TenantContextInterceptor`, and an
  injectable read-only resolved-tenant service for later authorization guards.

## Boundaries

Depends on core, identifiers, Nest 11, and RxJS. Uses a private WeakMap between guard and interceptor;
only marked routes resolve. Accepted ADR-0023 is authoritative.
