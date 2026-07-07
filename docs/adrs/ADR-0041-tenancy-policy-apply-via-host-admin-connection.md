# ADR-0041: Tenancy Policy Apply Via Host Admin Connection

## Status

Accepted

## Context

`tenancy policy` generates forced-RLS DDL but executes nothing — the user applies it by hand. That is the
biggest remaining "write/run SQL yourself" friction (the NestJS feedback; Tenancy for Laravel v4 applies
+ versions RLS for you). We want an opt-in `--apply`. Constraint: the CLI is **zero-dependency** and
**never invokes a shell**, so it cannot import a Postgres driver or shell out to `psql`.

## Decision

`tenancy policy --apply` runs the generated DDL through a **host-provided admin connection on the
runtime**:

- Add an optional `admin?: TenancyAdminConnection` (`{ query(sql) }`, i.e. `pg`'s Pool/Client) to
  `defineTenancyRuntime`. The host's `tenancy.config` brings `pg`; the CLI stays zero-dep and simply
  calls `runtime.admin.query(sql)`.
- `--apply` reuses the **exact** `generatePolicySql` the non-apply path prints (single source — generate
  and apply never drift; DRY), then executes it via `withRuntime` (load → run → dispose).
- Fails closed when the runtime has no `admin`. Validates identifiers before loading the runtime.
- Applies only the RLS contract (idempotent `ENABLE`/`FORCE`, `DROP POLICY IF EXISTS` + `CREATE POLICY`,
  `GRANT`); it does **not** create the runtime role (that needs a password and privileges — the printed
  DDL shows the `CREATE ROLE` for the human).

## Alternatives Considered

- Add `pg` as a CLI dependency and connect directly: rejected — breaks the zero-dependency guarantee.
- Shell out to `psql`: rejected — the CLI never invokes a shell (security boundary).
- A programmatic `applyPostgresRlsPolicies` in adapter-shared instead of a CLI flag: viable, but the
  user asked for `policy --apply`, and the runtime-admin route keeps a single DDL source and stays
  zero-dep. (The helper remains a possible future export.)

## Consequences

- Improves: one command applies the reviewed RLS instead of hand-running SQL; generate and apply share
  one DDL source; the admin/runtime-role separation is now first-class on the runtime.
- Risks: `--apply` runs privileged DDL — mitigated by opt-in, identifier validation, idempotent
  statements, atomic multi-statement apply, and not creating the role. The `admin` connection is the
  host's responsibility to keep separate from the runtime role (documented).

## Related Documents

- PRD: docs/40-features/F-020-policy-apply/PRD.md
- Feature: F-020-policy-apply
- Security: docs/20-security/SECURITY_MODEL.md (DDL never via the runtime role)
