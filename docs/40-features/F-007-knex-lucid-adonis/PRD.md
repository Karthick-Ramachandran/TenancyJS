# PRD: Knex, Lucid, And AdonisJS Vertical Slice

## Purpose

Deliver the first secure AdonisJS tenancy path without pretending that Lucid is only a Knex alias.
Generic Knex applications need a native fluent client boundary; AdonisJS applications additionally
need Lucid model lifecycle behavior, IoC registration, HTTP middleware, Japa helpers, Ace integration,
and framework-native configuration.

Knex has no stable late query-rewrite hook, and Lucid documents hook-bypassing paths such as quiet
writes, plain-object reads, and bulk mutations. The slice therefore uses application-level scoping
plus PostgreSQL row-level security (RLS) as the final enforcement boundary. Unsupported escape
surfaces fail closed.

## Users And Use Cases

- Generic Node/Express applications using Knex 3.3 with a shared PostgreSQL database.
- AdonisJS 7.3 applications using Lucid 22.4 and expecting model/provider/middleware conventions.
- Test authors who need Japa-native tenant scopes and two-tenant isolation evidence.
- Operators who need Adonis-facing diagnostics without duplicate Ace migration/seed logic.

## In Scope

- `@tenancyjs/adapter-knex`: configured table classification, protected fluent builders, managed
  transactions, RLS context, policy validation, typed errors, and an explicit operation matrix.
- `@tenancyjs/adapter-lucid`: a distinct Lucid transaction/model lifecycle surface backed by the Knex
  enforcement primitives, including read/paginate hooks, create injection, discriminator immutability,
  transaction attachment, and relationship/quiet/bulk behavior documentation.
- `@tenancyjs/integration-adonis`: config helpers, IoC provider, tenant HTTP middleware, sanitized
  errors, Japa helpers, and thin Ace wrappers over existing CLI services.
- Safe CLI templates for an Adonis + Lucid project, using the existing preview/apply engine.
- `examples/adonis-lucid` with PostgreSQL production HTTP, Lucid model, Japa, and isolation evidence.
- Knex 3.3/PostgreSQL 17 on Node 22 and 24; AdonisJS 7.3/Lucid 22.4/PostgreSQL 17 on Node 24.

## Non-Goals

- AdonisJS 6 compatibility; the initial integration targets current AdonisJS 7 conventions.
- MySQL, MariaDB, SQLite, or provider-neutral RLS claims without equivalent enforcement evidence.
- Database-per-tenant connection switching, provisioning, or pool management; T-11 owns that strategy.
- Reimplementing Knex/Lucid migrations, seeds, or tenant iteration; T-10 owns native delegation.
- Supporting arbitrary raw SQL, schema builders, migration APIs, base clients, or unclassified tables.
- Authentication, Bouncer authorization policy, sessions, Inertia, queues, cache, or storage tenancy.
