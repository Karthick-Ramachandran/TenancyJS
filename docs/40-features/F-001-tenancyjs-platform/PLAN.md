# Plan: Tenancyjs Platform

## Approach

Deliver secure vertical slices over shared contracts. Each phase ends with executable isolation
evidence and may ship independently; later breadth cannot weaken earlier gates.

### Phase 0: Decisions And Repository Foundation

- Review and accept/revise ADR-0001 through ADR-0003.
- Scaffold pnpm workspace, package build/test conventions, CI services, changesets, examples, and docs.
- Establish supported Node/TypeScript/peer-version policy and package status labels.
- Exit: repository gates run on an empty package skeleton and module memories exist for active work.

### Phase 1: Core And Testing Contracts

- Implement `@tenancyjs/core`, identifiers, and `@tenancyjs/testing` core contracts.
- Prove concurrency, nesting, cleanup, bootstrap rollback, strict mode, and central scope.
- Exit: no framework or ORM dependency in core; threat-model review and core tests pass.

### Phase 2: v0.1 Express + Prisma Reference Slice

- Implement the adapter contract, Prisma row-level adapter, Express integration, and example.
- Build minimal CLI detection, dry-run/apply engine, `init`, `doctor`, and leak-test command.
- Exit: generated Express+Prisma fixture and example pass two-tenant E2E on PostgreSQL.

### Phase 3: v0.2 Next.js + Prisma

- Implement App Router Node-runtime wrappers and Edge identity-hint handoff.
- Add Next template transforms and example; document caching and runtime boundaries.
- Exit: route handler, action, concurrent request, and build/start E2E tests pass.

### Phase 4: v0.3 AdonisJS + Lucid/Knex

- Implement Knex primitives, dedicated Lucid adapter, Adonis provider/middleware/config, Japa helpers,
  and thin Ace wrappers over CLI services.
- Exit: Adonis+Lucid example and generic Knex contract tests pass without duplicate context storage.

### Phase 5: v0.4 NestJS + Prisma/Sequelize And Adapter Breadth

- Implement Sequelize adapter and Nest dynamic module/lifecycle integration.
- Exercise Nest+Prisma and Nest+Sequelize; add supported Express combinations where evidence exists.
- Exit: all four requested data layers and frameworks have at least one stable vertical slice, and the
  published matrix distinguishes tested combinations from theoretically composable ones.

### Phase 6: v0.5 Database-Per-Tenant Operations

- Add connection provisioning contract, registry operations, bounded tenant iteration, native
  migration/seed delegates, failure summaries, and resume behavior.
- Start with one proven SQL path, then add capability-gated delegates per data layer.
- Exit: provisioning and migrations are idempotent, dry-runnable, credential-safe, and recoverable in
  integration tests. Row-level mode remains the default.

### Phase 7: v1 Hardening

- Freeze supported public APIs, publish benchmarks and upgrade policy, complete docs and security
  review, and graduate only combinations with sustained CI evidence.
- Exit: all quality gates and acceptance criteria pass with no unresolved critical/high findings.

## Boundaries

- Do not implement multiple adapters before the shared isolation contract passes for Prisma.
- Do not treat Next.js middleware as a database-capable runtime or promise universal Edge support.
- Do not treat NestJS's Express platform as raw Express compatibility evidence.
- Do not treat Lucid as merely Knex; share internals only below its public adapter contract.
- Do not implement migrations; invoke native local tooling through reviewed delegates.
- Do not add database-per-tenant or schema-per-tenant before row-level isolation is proven.
- Do not advertise an untested Cartesian product of frameworks and adapters.
- Implementation remains blocked until ADRs are accepted and task T-01 is explicitly selected.

## Initial Stable Matrix Target

| Vertical slice | Initial status target |
|---|---|
| Express + Prisma | v0.1 stable reference |
| Next.js App Router + Prisma | v0.2 stable |
| AdonisJS + Lucid | v0.3 stable |
| Express + Knex | v0.3 stable |
| NestJS + Prisma | v0.4 stable |
| NestJS + Sequelize | v0.4 stable |
| Other requested combinations | Experimental until their own CI/example evidence exists |
