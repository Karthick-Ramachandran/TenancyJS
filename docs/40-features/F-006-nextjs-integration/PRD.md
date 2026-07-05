# PRD: Nextjs Integration

## Purpose

Provide the second secure framework slice: Next.js App Router applications need tenant context in Route
Handlers and Server Actions while keeping Edge middleware, caching, and Prisma boundaries explicit.

## In Scope

- `tenancyjs-integration-next` Node wrappers and Edge-safe untrusted hint handoff.
- Next 16.2 + Prisma reference app with production build/start PostgreSQL E2E.
- Route Handler, Server Action, concurrency, forged-hint, failure, streaming, and caching guidance/tests.
- CLI detection/template extension only after runtime behavior is proven.

## Non-Goals

- Pages Router, Edge database access, authentication, signed tokens, universal cache rewriting, or
  compatibility beyond the tested Next/Prisma slice.
