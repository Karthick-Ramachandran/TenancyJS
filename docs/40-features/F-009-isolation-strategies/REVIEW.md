# Review: Isolation Strategies

## Status

Architecture, conventions, and security reviews passed locally. Runtime strategies and host-delegated
provisioning orchestration are implemented.

## Findings

- Architecture: no conflict with ADR-0017/0018. ADR-0019 records the new package boundary and central
  shadow rule. Core remains database-neutral and ORM packages remain user-facing.
- Security: duplicated RLS/context SQL is removed from Knex/Lucid; all SQL values are parameterized;
  schema names are validated; resolver/catalog failures fail closed with sanitized adapter errors.
- Isolation tier: shared-role schema mode is adapter-enforced; the optional per-tenant-role mode is
  database-enforced. Base/raw shared-role clients remain outside the default guarantee.
- Lucid: bulk/quiet/`.pojo()` paths do not inherit the managed transaction. Central tenant-table
  shadowing is rejected so these unqualified paths fail closed; real PostgreSQL evidence confirms it.
- Testing: local PostgreSQL 17 focused evidence passes 11/11 across Knex schema and Lucid row/schema
  suites. The no-database workspace run passes 308 tests with 44 environment-skipped tests and all
  coverage floors.
- Follow-up consolidations landed: shared adapter errors, integration HTTP mapping, CLI capability
  derivation, all three database-per-tenant bindings, and the optional database-enforced schema role.
  Typed enforcement-tier metadata remains deferred; provisioning was later completed through the
  F-012 host-hook design.
- Current local gate: PostgreSQL/MySQL/MongoDB `pnpm check` passes 587 tests, all coverage floors, 15
  packed-package consumer checks, and Persist Doctor. The high-severity audit gate passes with one
  moderate advisory reported below threshold.
- Database-per-tenant cache review: ADR-0021/0022 produce one bounded, single-flight,
  collision-aware, lease-safe lifecycle with sanitized failures. Knex, Lucid, and Prisma capabilities
  are supported after real separate-database evidence.
- Post-merge isolation review: the Lucid nested cross-tenant transaction reuse bug was fixed in PR #25.
  Remaining findings were closed with same-connection role/search-path reversion evidence, a lifetime
  tenant/schema collision guard, colliding-ID write assertions for all database routers, a public
  Prisma-router collision test, honest lazy-validation warnings, and callback-lifetime documentation.
- Expansion review: ADR-0030 preserves the rejected Prisma `search_path` lesson and uses the official
  Prisma 7 driver schema binding. TypeORM/Sequelize remain thin shared-engine/cache bindings; Mongoose
  database routing reuses the same cache. Fixed-schema ORM metadata is rejected before execution.
- New evidence: Prisma schema/PostgreSQL, Prisma database/MySQL, TypeORM and Sequelize schema/database
  PostgreSQL, and Mongoose database/MongoDB all pass real colliding-ID adversarial tests plus public
  placement-collision checks.
- Final drift/security pass found no blocker: dependency direction is unchanged; no runtime network,
  telemetry, secret handling, MCP, or file-write surface was added; credential-scope limitations remain
  explicitly documented.
