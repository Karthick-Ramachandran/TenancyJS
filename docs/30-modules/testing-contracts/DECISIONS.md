# Module Decisions: Testing Contracts

Record durable module decisions here.

## Current Decisions

- ADR-0006 governs runner-neutral `{ name, run }` contract cases and typed assertion failures.
- ADR-0007 adds the runner-neutral two-tenant row-level adapter contract without adding an ORM dependency.
- Published testing helpers have no Vitest/Jest/Mocha runtime dependency.
