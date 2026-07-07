# Acceptance Criteria: Postgres Provisioners

## Criteria

- `createPostgresSchemaProvisioner({ admin, schema })` returns a `TenancyProvisioner`; `provision(tenant)`
  runs `create schema if not exists "<schema>"` on the admin connection, idempotent across repeat calls.
- `deprovision(tenant)` runs `drop schema if exists "<schema>" cascade`.
- `createPostgresDatabaseProvisioner({ admin, database })`: `provision` creates the database only when it
  does not already exist (checked against `pg_database`); repeat calls are a no-op. `deprovision` runs
  `drop database if exists "<db>" with (force)`.
- When a `migrate` callback is supplied, `provisioner.migrate(tenant)` invokes it with the tenant (and its
  resolved placement); when it is omitted, `provisioner.migrate` is absent (so the CLI reports "no migrate
  hook" rather than silently succeeding).
- A `schema`/`database` resolver returning a non-identifier value (spaces, quotes, `;`, `--`) throws
  before any SQL runs — no DDL injection is possible from a tenant-derived name.
- The admin connection is only ever used for DDL; the provisioner never touches the runtime/tenant
  connection. Verified against real PostgreSQL: provision → migrate hook fires → deprovision, for both
  schema and database variants, idempotently.
- Wired end to end: a `defineTenancyRuntime({ provisioner: createPostgresSchemaProvisioner(...) })` +
  `tenancyjs-cli tenant provision|migrate|deprovision` round-trips against a real database.

## Out Of Scope

- MySQL/Mongo provisioners; running the ORM migrator itself; creating roles/RLS policies; row-level.
