# Module: Integration Express

## Purpose

Bridge Express 5 request/response lifecycle into the framework-neutral TenancyJS resolution and
context contracts without duplicating tenant state or ORM behavior.

## Owns

- Express request-to-`ResolverInput` adaptation.
- `createExpressTenancyMiddleware` configuration validation and middleware behavior.
- Exhaustive mapping from non-resolved outcomes to typed Express integration errors.
- Request lifecycle settlement across finish, close, abort, and dispatch failure.
- Express-specific package docs, conformance harness, compatibility evidence, and example wiring.

## Does Not Own

- Tenant context storage/lifecycle (`@tenancyjs/core`).
- Identifier parsing, precedence, lookup, or tenant registry (`@tenancyjs/identifiers` and host app).
- Authentication, membership authorization, sessions, or central-route policy.
- Prisma query enforcement or any other data-layer behavior.
- CLI generation, migrations, provisioning, or database-per-tenant connection selection.

## Public Interfaces

- Proposed `createExpressTenancyMiddleware(options): express.RequestHandler`.
- Proposed `ExpressTenancyMiddlewareOptions<TTenant>` containing application-owned `manager`,
  `resolver`, and optional `onError`.
- Proposed `ExpressTenancyResolutionError` with stable code, HTTP status, and non-secret reason.
- Supporting exported types for the resolver service and error handler.

Exact signatures remain blocked on ADR-0008 acceptance.

## Boundaries

- Depends on public core and identifiers contracts plus Express as a peer.
- Does not import adapters; applications compose the integration and adapter at the top level.
- Only `resolved` outcomes enter tenant context; all others fail closed.
- The manager scope remains lexical until an HTTP terminal signal and settles once.
- No mutable process-global/request-global tenant state, telemetry, storage, runtime outbound network,
  file writes, secret reads, or central-mode selection.
- Stable claims require the portable integration contract, Supertest, PostgreSQL example E2E, clean
  package consumer, and Node 22/24 CI.
