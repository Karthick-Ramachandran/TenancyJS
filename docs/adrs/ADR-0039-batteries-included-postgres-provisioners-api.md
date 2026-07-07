# ADR-0039: Batteries Included Postgres Provisioners API

## Status

Accepted

## Context

Schema- and database-per-tenant require the host to implement `provision`/`deprovision`/`migrate` hooks
by hand — identical-for-everyone DDL (CREATE SCHEMA/DATABASE, DROP, run migrator). This is the biggest
chunk of code a user writes beyond `init` (see F-018 PRD). We want a batteries-included provisioner the
host passes to `defineTenancyRuntime`, without TenancyJS running an ORM migrator itself or coupling to a
specific driver's placeholder dialect.

## Decision

Ship two factories in `tenancyjs-adapter-shared` returning a `TenancyProvisioner`:

- `createPostgresSchemaProvisioner({ admin, schema, migrate? })`
- `createPostgresDatabaseProvisioner({ admin, database, migrate? })`

Key decisions:

- **Admin seam is a minimal `PostgresAdminConnection` = `{ query(sql, params?) => Promise<{ rows? }> }`
  using `$1` placeholders** — this is exactly `pg`'s Pool/Client shape, so a host passes its existing
  privileged connection with zero wrapping. (We deliberately do NOT reuse the adapter-internal
  `PostgresExecutor` `?`-placeholder seam here; that one exists for adapters binding their ORM's query
  fn, and forcing hosts through it would add friction, the opposite of this feature's goal.)
- **Placement names are validated with the existing `assertSqlIdentifier`** (DRY) and then interpolated
  double-quoted into DDL, because DDL identifiers cannot be bound parameters. The `[A-Za-z0-9_]`-only
  identifier grammar makes interpolation injection-safe. The one bound query (database existence) uses
  `$1`.
- **`migrate` stays a host callback** — we call it against the resolved placement; we never run the
  ORM's migrator. When omitted, `provisioner.migrate` is absent so the CLI reports "no migrate hook"
  instead of a silent success.
- **The admin connection is only ever used for DDL**, explicitly separate from the fail-closed runtime
  role — reinforcing the SECURITY_MODEL rule that DDL never runs through the runtime connection.

## Alternatives Considered

- Reuse `PostgresExecutor` (`?` placeholders) for `admin`: rejected — hosts hold a `pg`-native `$1`
  connection; the translation is friction.
- A whole new `tenancyjs-provisioning` package: rejected for now — the logic is small and Postgres-only
  and belongs with the existing shared Postgres SQL engine.
- Have TenancyJS run the ORM migrations: rejected — the project's standing rule is it never invokes an
  ORM; migrators differ per ORM and are the host's.

## Consequences

- Improves: schema-/database-per-tenant hosts point at a migrator instead of writing DDL — the biggest
  post-setup friction goes away; the `tenant provision|migrate|deprovision` CLI now has a ready hook.
- Risks: `deprovision`/`DROP DATABASE ... FORCE` is destructive — mitigated by the CLI already gating
  deprovision to an explicit id, and by validated identifiers preventing injection.
- Follow-up: MySQL/Mongo provisioners; an `onboarding` helper built on these.

## Related Documents

- PRD: docs/40-features/F-018-postgres-provisioners/PRD.md
- Feature: F-018-postgres-provisioners
- Security: docs/20-security/SECURITY_MODEL.md (DDL never via the runtime role)
