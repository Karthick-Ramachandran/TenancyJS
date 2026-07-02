# Module Decisions: Integration Express

Record durable module decisions here.

## Current Decisions

- ADR-0001: keep Express behavior in its own integration package.
- ADR-0002/ADR-0005: reuse lexical `TenancyManager` scopes; never add process-global tenant state.
- ADR-0006: consume exhaustive resolution outcomes; resolution does not authenticate membership.
- ADR-0008: hold context through HTTP terminal signals and expose typed non-secret failures.
- Express 5.2.x is the first compatibility target; Express 4 requires separate evidence.
- The package imports no adapter; the Express + Prisma example composes public packages.
