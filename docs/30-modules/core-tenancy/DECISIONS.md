# Module Decisions: Core Tenancy

Record durable module decisions here.

## Current Decisions

- Accepted: use layered package boundaries from ADR-0001.
- Accepted: use async-local tenant context with strict fail-closed defaults from ADR-0002.
- Product constraint: row-level isolation is delivered and proven before database-per-tenant behavior.
- Module constraint: core contains no framework or ORM dependency and no mutable global tenant state.

ADR-0001 and ADR-0002 are accepted repository source of truth.
