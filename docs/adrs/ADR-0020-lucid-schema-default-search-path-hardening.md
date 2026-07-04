# ADR-0020: Lucid Schema Default Search Path Hardening

## Status

Accepted

## Context

ADR-0019 prevents Lucid hook-skipping operations from resolving tenant tables by requiring those table
names to be absent from the configured central schema. PostgreSQL unqualified resolution uses the
connection's effective default `search_path`, however, which may include schemas other than the
configured central schema (`$user`, `public`, or application-configured entries). A same-named tenant
table in any of those schemas would let `.pojo()`, quiet, bulk, or direct unqualified work resolve a
table without inheriting the managed transaction's tenant `search_path`.

## Decision

1. Schema-strategy startup validation queries every effective default-search-path schema using
   `current_schemas(false)` and rejects the adapter if any configured tenant-table name resolves there.
2. Keep ADR-0019's central-schema shadow check as a separate invariant; a custom central schema may not
   be on the runtime role's default path, so both checks are required.
3. Parameterize the tenant-table list and return only a sanitized validation issue. Never include
   schema names, tenant placement, SQL bindings, or connection details in the public finding.
4. Run this validation for the shared PostgreSQL schema engine so Knex and Lucid receive the same
   conservative boundary, even though Lucid hook bypass is the motivating risk.
5. Runtime/application code must not mutate pooled connections' default search path outside reviewed
   adapter transactions. Such retained base-client behavior remains outside the guarantee.

## Alternatives Considered

- Check only the configured central schema: rejected because it does not model actual PostgreSQL name
  resolution on an unscoped connection.
- Force a session-level default search path: rejected because session mutation can leak across pooled
  tenants; TenancyJS uses transaction-local settings only.
- Treat every Lucid hook-skipping API as interceptable: rejected because Lucid intentionally bypasses
  model hooks for these paths.
- Require per-tenant roles now: deferred under ADR-0018; it is the stronger future tier but not the
  accepted default for this increment.

## Consequences

Schema-mode validation now matches PostgreSQL's effective unqualified-resolution behavior and closes a
central-only validation gap. Hook-skipping unqualified operations fail with no relation even when the
runtime role has a custom default path.

Startup performs one additional catalog query. Applications that intentionally expose a same-named
table on the runtime role's default path must remove it or use a different role/configuration before
schema mode unlocks. Retained qualified/raw clients remain outside adapter-enforced isolation.

## Related Documents

- PRD: `docs/40-features/F-009-isolation-strategies/PRD.md`
- Architecture: `docs/40-features/F-009-isolation-strategies/ARCHITECTURE_IMPACT.md`
- Security: `docs/20-security/SECURITY_MODEL.md`
- Feature: `docs/40-features/F-009-isolation-strategies/`
- Related decisions: ADR-0018, ADR-0019
