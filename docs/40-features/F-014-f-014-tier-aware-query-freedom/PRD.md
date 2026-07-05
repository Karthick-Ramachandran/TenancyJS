# PRD: Tier-Aware Query Freedom

## Purpose

Remove the biggest adoption friction — the facade rejecting nested reads/writes, joins, and raw queries
— *without* weakening isolation. Where the database or connection already enforces isolation for every
query (database-per-tenant, PostgreSQL row-level+forced-RLS, schema-per-tenant+role), give developers
full query freedom by handing them the real tenant-scoped client. Where the facade is the only guard
(MySQL row-level, Mongoose, role-less schema-per-tenant), keep the restrictions. See ADR-0033.

## In Scope

- An explicit **enforcement tier** (`database-enforced` | `facade-enforced`) resolved per scope from the
  *actual* enforcement in effect (validated forced RLS / per-tenant role / separate connection).
- In `database-enforced` scopes, `run()` yields the real scoped ORM client (full nested/join/raw).
- In `facade-enforced` scopes, `run()` yields the current restricted facade (unchanged).
- Capability reporting reflects the tier; `nestedReads`/`nestedWrites`/`rawQueries` flip to supported
  per tier only after that tier's adversarial test passes.
- Roll out per tier, safest first: database-per-tenant → Postgres row-level+RLS → schema-per-tenant+role.

## Non-Goals

- Relaxing anything on MySQL, MongoDB, or role-less schema-per-tenant (no backstop → stay restricted).
- Changing fail-closed-on-missing-context, central scope, cross-placement rejection, or disposal.
- A user opt-in "trust me" flag (safety is derived, never claimed).
