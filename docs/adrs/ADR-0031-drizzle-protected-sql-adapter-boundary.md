# ADR-0031: Drizzle Protected SQL Adapter Boundary

## Status

Accepted

## Context

Drizzle is requested as a launch adapter. Its native database, transaction, SQL expression, relational
query, and schema objects expose operations that cannot be exhaustively intercepted. Drizzle's current
stable line is 0.45.x; 1.0 remains prerelease. Official documentation provides driver-specific
`node-postgres` and `mysql2` clients, managed `db.transaction(...)`, PostgreSQL schema declarations,
and PostgreSQL RLS declarations, but those features do not make an unrestricted native handle a safe
tenant boundary.

## Decision

1. Publish `tenancyjs-adapter-drizzle` for stable `drizzle-orm >=0.45 <1`, Node 24, PostgreSQL through
   `node-postgres`, and MySQL through `mysql2`.
2. Expose `createDrizzleTenancy` with exhaustive table registration and callback-scoped protected
   plain-value facades. Native databases, transactions, table objects, SQL expressions, relational
   queries, migrations, and raw execution never cross the public callback boundary.
3. The initial facade supports reviewed select/find/count/insert/update/delete operations with plain
   scalar equality. Tenant filters are composed, creates inject or validate the tenant column, and
   updates cannot change it. Unknown tables and unsupported values fail closed.
4. PostgreSQL row and schema modes reuse `tenancyjs-adapter-shared` for forced RLS, transaction-local
   context, schema validation, `search_path`, optional role, and placement collision checks.
5. Database mode reuses `createTenantResourceCache`; the host creates dialect-specific Drizzle
   resources behind opaque placement keys and TenancyJS owns callback/lease lifetime only. A
   cache-owned tenant binding must provide its pool `close` callback or creation fails before use.
6. The adapter receives a small dialect binding that owns managed transactions and reviewed CRUD
   operations. This keeps driver-specific types internal while preserving actual Drizzle execution.
7. A capability is supported only after its real-database colliding-ID adversarial suite passes.
   MongoDB is not a Drizzle target.

## Alternatives Considered

- Expose native Drizzle `db`/`tx`: rejected because raw SQL, arbitrary tables, joins, and unclassified
  operations bypass the tenant contract.
- Depend on Drizzle RLS declarations alone: rejected because declarations generate schema intent but do
  not validate deployed policies, runtime role privilege, or `FORCE ROW LEVEL SECURITY`.
- Build a full ORM-independent query language: rejected because it would duplicate Drizzle and expand
  the security surface. The facade remains deliberately small and typed around registered tables.
- Target Drizzle 1.0 beta/RC: rejected until stable and independently tested.

## Consequences

Drizzle users get the same fail-closed subset and shared isolation engine as other SQL adapters. The
surface is narrower than native Drizzle and advanced query composition remains outside the guarantee.
Driver bindings add explicit code per dialect, but isolation decisions and lifecycle stay shared.

## Related Documents

- Feature: `docs/40-features/F-013-drizzle-mysql-support/`
- Module: `docs/30-modules/drizzle-adapter/`
- Security: `docs/20-security/ADAPTER_SECURITY_CONTRACT.md`
- Related decisions: ADR-0019, ADR-0021, ADR-0032
