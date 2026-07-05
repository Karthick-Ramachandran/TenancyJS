# PRD: Express Integration

## Purpose

Provide the first framework integration and complete the Express + Prisma reference slice. Express
applications need an explicit bridge from untrusted request identity to the canonical
`TenancyManager` scope; hand-written middleware commonly resolves a tenant but releases or leaks the
scope at the wrong point in the response lifecycle.

The feature gives application authors one reviewed middleware factory, typed fail-closed resolution
errors, a runnable Prisma example, and reusable evidence that concurrent requests cannot cross tenant
context or data.

## Users And Use Cases

- Express 5 application authors using TenancyJS resolvers and adapters.
- Library evaluators who need a minimal, readable Express + Prisma reference application.
- Maintainers who need one framework conformance target before adding other integrations.

## In Scope

- Publish `tenancyjs-integration-express` with an Express 5 middleware factory.
- Adapt Express request headers and host information into the existing `TenantResolutionChain` input.
- Enter `TenancyManager.runWithTenant` only after a `resolved` outcome.
- Keep the lexical tenant lifecycle active through response finish, response close, request abort, or
  synchronous dispatch failure, with exactly-once cleanup.
- Map every non-resolved outcome to a typed, non-secret error and support an explicit `onError` hook.
- Pass resolver, store, lifecycle, and application failures to Express error handling without silently
  selecting central context.
- Run the portable integration contract plus Supertest concurrency, rejection, and abort coverage.
- Add `examples/express-prisma` and a PostgreSQL E2E proving tenant A cannot observe or mutate tenant B.
- Verify package contents and clean-consumer ESM/types behavior for the new integration.

## Non-Goals

- Authentication, user-to-tenant membership authorization, sessions, or token verification.
- Query scoping inside the Express package; adapters retain that responsibility.
- Request-controlled central context, unsafe bypass, or a default public central route.
- Express 4 compatibility until a dedicated compatibility lane proves its promise-handling behavior.
- Next.js, NestJS, Fastify, AdonisJS, WebSocket, background-job, or Edge-runtime integration.
- CLI generation, database-per-tenant connection selection, or migrations.
- Adding a second request-local tenant store or attaching mutable tenant state to Express globals.
