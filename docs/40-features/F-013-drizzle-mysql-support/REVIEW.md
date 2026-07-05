# Review: Drizzle And MySQL Support

## Status

Approved locally. Hosted CI and human merge review remain external release gates.

## Architecture Drift

No blocker. `tenancyjs-adapter-drizzle` follows the accepted layered boundary: core remains neutral,
PostgreSQL SQL and database-resource lifecycle come from adapter-shared, and the CLI only scaffolds
public package APIs. ADR-0031/0032 and F-013 document the new dependency and enforcement decisions.

## Conventions

No blocker. The implementation reuses `TenancyManager`, `TenancyAdapter`,
`createPostgresStrategyEngine`, `createTenantResourceCache`, shared discriminator decisions, package
naming, and callback-scoped protected facades. The new binding/factory vocabulary is recorded in
`CONVENTIONS.md`; the array-parameter failure is recorded in `LESSONS.md`.

## Security

No blocker found after hardening.

- PostgreSQL row mode retains forced-RLS validation and transaction-local context.
- MySQL row mode is explicitly adapter-enforced/experimental and exposes no native handle in the
  protected callback.
- Every database-strategy tenant resource is dialect-checked. Cache-owned Drizzle bindings must
  provide deterministic cleanup before they are admitted.
- Raw SQL, native clients/transactions, unknown tables, complex criteria, relation APIs, joins, and
  cross-placement access remain outside or rejected by the protected boundary.
- CLI writes still use the existing preview, containment, symlink, conflict, and no-overwrite path.
- No telemetry, runtime network client, secret handling, cloud, AI, or MCP behavior was added.

## Evidence Review

Real PostgreSQL and MySQL suites use tenant A/B colliding IDs and cover reads plus mutations. Schema
and database placement collision guards are exercised. Full coverage floors and packed-consumer import
pass. Documentation matrices name database and enforcement tier rather than relying on adapter-level
capabilities alone.

## Remaining Risks

- MySQL row isolation has no database backstop; a retained native ORM/Drizzle handle bypasses it.
- Database routing is server-authorized only with per-tenant credentials.
- Drizzle 1.0 is prerelease and intentionally outside the peer range.
- The full dependency audit reports Sequelize's existing `uuid@8` moderate advisory; production-only
  audit is clean, and forcing a semver-major transitive override was rejected without Sequelize proof.

