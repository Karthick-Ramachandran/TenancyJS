# Module: Integration Next

## Purpose

Bridge Next.js App Router Node execution into TenancyJS while keeping Edge identity hints untrusted.

## Owns

- Route Handler/Server Action wrappers, request adaptation, typed failures, Edge hint transport,
  lifecycle/cache/stream guidance, Next compatibility evidence.

## Does Not Own

- Tenant storage, authentication/authorization, Prisma scoping, Edge database access, signed-token
  infrastructure, Pages Router, or application cache policy.

## Public Interfaces

- `createNextTenancy`, `withRouteHandler`, `withServerAction`, `runWithRequest`, typed errors, and the
  separate Edge-safe `createNextTenantHint`/`withNextTenantHint` helpers.

## Boundaries

- Depends on core/identifiers with Next peer; imports no adapter. ADR-0009 controls Node/Edge behavior.
