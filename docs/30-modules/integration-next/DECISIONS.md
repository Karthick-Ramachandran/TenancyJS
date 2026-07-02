# Module Decisions: Integration Next

Record durable module decisions here.

## Current Decisions

- ADR-0002 provides Node async context; ADR-0009 accepts Next-specific Node/Edge boundaries.
- Next 16.2.x is the initial target; Pages Router is unsupported.
- Edge hints are untrusted transport metadata and never establish context directly.
