# Module Test Plan: Adapter Shared

## Unit Tests

- SQL identifiers: standard PostgreSQL names, leading-underscore policy, qualified/unqualified tables,
  malformed and injection-shaped input.
- Tenant discriminator: create inject/equal/conflict and update-field rejection.
- RLS catalog result parsing: privileged role, missing table, ownership, unforced policy, invalid
  expressions, sanitized introspection failure.
- Schema strategy: missing/central-equal/inaccessible schemas, missing tables, transaction-local SQL,
  tenant and central context, resolver failure redaction, tenant/schema collision and remapping, and no
  retained claim after a database-context failure.
- Resource cache: invalid/secret-shaped keys, mapping collision, single-flight creation, callback
  cleanup, active-capacity rejection, idle LRU eviction, sanitized create/destroy failure, shutdown
  blocking, retry, and continued cleanup.

## Integration Tests

- Knex and Lucid bindings preserve row-level behavior after consolidation.
- Separate real-PostgreSQL two-schema suites prove tenant A/B read/write isolation, central placement,
  rollback/savepoints, concurrent scopes, and pooled-connection cleanup.
- A single-connection PostgreSQL role suite proves role and `search_path` state revert after commit and
  before the same backend is reused for another tenant.
- Separate-database Knex/Lucid/Prisma suites use colliding primary keys and prove tenant-A writes leave
  tenant B unchanged; the Prisma public router exercises placement collision rejection.

## Security Tests

- Raw and qualified cross-schema access remain unavailable from protected surfaces.
- Tenant schema and central schema cannot coincide.
- Two tenant identities cannot claim one schema, and one tenant cannot change schemas during an engine
  lifetime.
- Lucid central and effective default-search-path schemas cannot contain tenant-table names, so
  hook-skipping unqualified paths fail closed.
- Validation and error output never contain tenant metadata, SQL bindings, or connection URLs.
