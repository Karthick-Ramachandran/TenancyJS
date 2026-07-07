# PRD: Postgres Provisioners

## Purpose

Today `defineTenancyRuntime({ provisioner })` is a bring-your-own hook: for schema- and
database-per-tenant, the user hand-writes the `provision`/`deprovision`/`migrate` logic (open a
privileged connection, `CREATE SCHEMA`/`CREATE DATABASE` idempotently, run their migrator, drop on
deprovision). That is identical-for-everyone infrastructure code and the single biggest chunk a user
writes *beyond setup* — pure friction against the "set up and just build" goal (see
friction-reduction-roadmap). Tenancy for Laravel automates this whole lifecycle; TenancyJS should ship
batteries-included Postgres provisioners so the host **points** at a migrator instead of **writing** the
DDL.

## In Scope

- `createPostgresSchemaProvisioner({ admin, schema, migrate? })` — `provision` does
  `CREATE SCHEMA IF NOT EXISTS`, `deprovision` does `DROP SCHEMA ... CASCADE`, `migrate` delegates to the
  host's `migrate` callback (against the tenant's schema). Returns a `TenancyProvisioner`.
- `createPostgresDatabaseProvisioner({ admin, database, migrate? })` — `provision` creates the database
  if absent (checked via `pg_database`), `deprovision` drops it `WITH (FORCE)`, `migrate` delegates.
- Placement names (`schema`/`database`) are validated as SQL identifiers (reuse `assertSqlIdentifier`) so
  a tenant-derived name can never inject DDL.
- The privileged `admin` connection is explicitly separate from the fail-closed runtime role; the DDL is
  never run through the runtime connection. Fail closed on a missing/invalid placement.
- Lives in `tenancyjs-adapter-shared` (the existing Postgres SQL home); exported for hosts to pass to
  `defineTenancyRuntime`.

## Non-Goals

- Running the ORM's migrations for the user (TenancyJS never invokes an ORM). `migrate` stays a host
  callback — we call it at the right time against the right placement, we don't reimplement migrators.
- MySQL / MongoDB provisioners (follow-up; MySQL database-per-tenant could reuse the database variant
  later).
- Creating the runtime role or RLS policy (that is `tenancy policy` / `--apply`, a separate feature).
- Row-level provisioning (row-level shares tables — nothing to provision).
