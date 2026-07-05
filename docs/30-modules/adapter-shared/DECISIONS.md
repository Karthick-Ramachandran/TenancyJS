# Module Decisions: Adapter Shared

## Current Decisions

- ADR-0019 establishes this package as the shared engine seat and keeps ORM APIs in their adapters.
- PostgreSQL context values use parameterized `set_config` with transaction-local scope only.
- Schema existence/access is validated on every protected transaction. The engine retains only a
  bidirectional tenant/schema identity registry—not database metadata or clients—so sequential mapping
  collisions cannot become cross-tenant access.
- ADR-0018's optional transaction-local per-tenant role is implemented; provisioning remains outside
  this module.
- ADR-0020 requires effective default-search-path shadow validation for schema mode; checking only the
  configured central schema is insufficient for unscoped Lucid name resolution.
- ADR-0021/0022 require all database-per-tenant adapters to use the shared bounded resource cache and
  its one-to-one tenant/opaque-key collision rule.
- Database-per-tenant startup validation reports configuration validity plus a warning; an open-ended
  tenant factory set cannot honestly be claimed as connected at startup.
