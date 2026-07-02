# Module Decisions: Core Tenancy

Record durable module decisions here.

## Current Decisions

- Accepted: use layered package boundaries from ADR-0001.
- Accepted: use async-local tenant context with strict fail-closed defaults from ADR-0002.
- Accepted: use the lexical lifecycle, shallow tenant snapshot, bootstrapper/event ordering, and error
  semantics from ADR-0005.
- Product constraint: row-level isolation is delivered and proven before database-per-tenant behavior.
- Module constraint: core contains no framework or ORM dependency and no mutable global tenant state.

ADR-0001, ADR-0002, and ADR-0005 are accepted repository source of truth.
