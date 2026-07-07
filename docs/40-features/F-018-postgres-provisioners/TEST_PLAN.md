# Test Plan: Postgres Provisioners

## Unit Tests

`packages/adapter-shared/test/provisioners.test.ts` (mock admin connection):

- Schema provisioner emits `create schema if not exists` / `drop schema ... cascade`, idempotently.
- Schema/database `migrate` delegates to the host callback with the resolved placement; hook is absent
  when no `migrate` is supplied.
- Database provisioner checks `pg_database` and creates only when absent (no-op when present); drops
  `with (force)`.

## Integration Tests

`packages/adapter-shared/test/provisioners-postgresql.integration.test.ts` (real PostgreSQL, skipped
without `TEST_DATABASE_URL`):

- Provision → `information_schema.schemata` shows the schema → provision again (idempotent) → migrate
  hook fires → deprovision → schema gone.
- Database provision only when absent → `pg_database` shows it → deprovision → gone.

## Security Tests

- A `schema`/`database` resolver returning a non-identifier (quotes, `;`, `--`, spaces) throws via
  `assertSqlIdentifier` before any SQL runs — no DDL injection from a tenant-derived name.
- Admin connection is used only for DDL; provisioners never touch the runtime/tenant connection
  (SECURITY_MODEL: DDL never via the runtime role).
