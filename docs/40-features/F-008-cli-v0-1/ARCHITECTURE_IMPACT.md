# Architecture Impact: CLI v0.1

## Affected Modules

- `@tenancyjs/cli` (F-005): `detection.ts`, `types.ts`, `templates.ts`, `plan.ts`, `cli.ts`, `bin.ts`,
  `output.ts`/`errors.ts`, plus new `capabilities.ts`. Interactivity is added only at the `bin.ts`
  boundary; `runCli` and the plan/detection core stay pure.
- Phase B will also touch a new tenant-registry module and the ORM adapters' migration surface.

## ADR Impact

- **Phase A:** new ADR for the interactive-`init` UX and CLI IO contract (mandatory selection, capability
  + Node banner, flag escape hatch, non-interactive safety, zero-dependency readline). Does not change any
  accepted ADR.
- **Phase B (later):** separate ADRs for the tenant-registry data model + config central-DB URL, and for
  the ORM-delegation contract. Not started until accepted.

## Security Impact

- Phase A: no new dependency, no network, no DB, no `.env` mutation. File writes reuse F-005's contained,
  symlink-rejecting, dry-run-by-default apply. Interactive input is read only from the TTY at `bin.ts`;
  it selects from a fixed choice set and is redacted like all other output.
- Phase B: introduces DB connectivity and subprocess ORM delegation — covered by its own ADRs/tests.
