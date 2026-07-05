# ADR-0032: MySQL Adapter Enforcement For TypeORM Sequelize And Drizzle

## Status

Accepted

## Context

TypeORM and Sequelize already protect a narrow facade, but their row validation and transaction setup
are PostgreSQL-specific. Database-per-tenant routing is dialect-neutral but lacks MySQL evidence.
MySQL has no PostgreSQL-equivalent row-level security or transaction-local `search_path`, and treats
schema and database as synonymous. Pretending the PostgreSQL engine applies would either fail at
runtime or overstate the guarantee.

## Decision

1. TypeORM, Sequelize, and Drizzle accept explicit `postgresql` or `mysql` dialect configuration and
   verify that it matches the actual base resource where the ORM exposes that information.
2. PostgreSQL behavior is unchanged: row mode requires forced RLS; schema mode uses the shared
   PostgreSQL engine.
3. MySQL row mode uses the same protected discriminator facade but performs no PostgreSQL session SQL.
   `validate()` returns valid with a warning that enforcement is adapter-only and experimental. Native
   ORM/database handles remain outside the guarantee.
4. MySQL database-per-tenant uses the existing bounded resource cache. Storage is physically separate;
   it is database-enforced only when credentials for one resource cannot access siblings. Shared root
   credentials prove routing, not credential-level authorization.
5. `schemaPerTenant` with MySQL is rejected. Users select `databasePerTenant` because MySQL schema and
   database namespaces are the same placement model.
6. TypeORM/Sequelize MySQL row and database capabilities are claimed only after separate real-MySQL
   two-tenant suites with colliding IDs prove read/write/update/delete isolation.
7. Documentation and CLI identify MySQL row mode as adapter-enforced/experimental, never equivalent to
   PostgreSQL forced RLS.

## Alternatives Considered

- Leave MySQL unclaimed: rejected because the protected facade and database router can be proven on
  MySQL without changing core.
- Emulate RLS with views, triggers, or session variables: rejected for the initial slice because those
  mechanisms are deployment-specific, easier to bypass, and not equivalent to PostgreSQL forced RLS.
- Call each MySQL database a schema strategy: rejected because it duplicates one physical placement
  model under two strategy names.
- Infer dialect only: rejected for Drizzle's structural boundary and for clear startup intent; explicit
  configuration plus available runtime verification fails earlier.

## Consequences

MySQL users gain honest, tested row and database support while accepting a weaker row guarantee. The
adapter must keep native ORM resources private; a retained native handle bypasses query scoping. The
capability matrix must be database-specific because an adapter-level `supported` flag alone cannot
express enforcement strength.

## Related Documents

- Feature: `docs/40-features/F-013-drizzle-mysql-support/`
- Security: `docs/20-security/SECURITY_MODEL.md`
- Related decisions: ADR-0017, ADR-0021, ADR-0024, ADR-0025, ADR-0031

