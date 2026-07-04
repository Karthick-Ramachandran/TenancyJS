# Module Decisions: Adapter Shared

## Current Decisions

- ADR-0019 establishes this package as the shared engine seat and keeps ORM APIs in their adapters.
- PostgreSQL context values use parameterized `set_config` with transaction-local scope only.
- Schema placement is validated on every protected transaction; no cache is accepted until invalidation
  and lifecycle behavior are designed.
- Provisioning and database-enforced per-tenant roles remain outside this increment.
- ADR-0020 requires effective default-search-path shadow validation for schema mode; checking only the
  configured central schema is insufficient for unscoped Lucid name resolution.
