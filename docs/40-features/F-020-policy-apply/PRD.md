# PRD: Policy Apply

## Purpose

`tenancy policy` prints forced-RLS DDL but runs nothing, so the user applies it by hand — the biggest
"write/run SQL yourself" friction (see friction-reduction-roadmap; Tenancy for Laravel v4 applies it for
you). Add an opt-in `tenancy policy --apply` that executes the reviewed DDL, without breaking the CLI's
zero-dependency / no-shell guarantees.

## In Scope

- Optional `admin` connection on `defineTenancyRuntime` (a `pg`-shaped `{ query(sql) }`), separate from
  the fail-closed runtime role.
- `tenancy policy --apply` reuses `generatePolicySql` (single DDL source) and runs it via the runtime's
  `admin` connection; `--config` selects the config. Fails closed with guidance when no `admin` is set.
- Idempotent apply; identifiers validated before any DB access.

## Non-Goals

- Creating the runtime role (needs a password/privileges; the printed DDL shows the `CREATE ROLE`).
- Policy versioning/hashing (Laravel-style) — a possible follow-up; `DROP POLICY IF EXISTS` already makes
  re-apply idempotent.
- Adding a Postgres driver to the CLI or shelling out.
