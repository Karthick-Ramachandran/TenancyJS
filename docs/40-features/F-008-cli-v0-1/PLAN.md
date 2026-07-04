# Plan: CLI v0.1

## Approach

### Phase A — `init` UX (build first, shippable)
1. **Detection**: add Next.js (`next` 16.x) to `detection.ts`; keep the version-gated, no-code-exec
   dependency sniffing. ORM stays derived (Adonis -> Lucid, Express/Next -> Prisma).
2. **Interactivity via `CliIo`**: extend `CliIo` with `isInteractive: boolean` and an injected
   `select(question, choices)` (and `confirm`). Real `bin.ts` implements them with `node:readline/promises`
   over the TTY; tests inject scripted answers. Core command logic stays pure and deterministic.
3. **Resolution order per field** (framework): explicit flag > clean supported detection > interactive
   mandatory select. Non-interactive (`--json`, `--yes`, non-TTY) never prompts; unresolved -> friendly
   `CliUsageError` naming `--framework`.
4. **Banner**: a `capabilities.ts` module exposing the supported matrix + Node floor; `init` prints it,
   checks `process.versions.node` (>= 24) and stops friendly if lower.
5. **Templates**: add `NEXT_PRISMA_TEMPLATES` in `templates.ts`; wire in `plan.ts` (framework `next`).
6. **Friendly errors**: a human-message layer in `output.ts`/`errors.ts`; `--json` keeps `code`.
7. **Help text** updated for the three stacks and the interactive flow.

### Phase B — operational engine (after Phase A; ADR-gated)
- ADRs first: tenant-registry data model (central `tenants`/`tenant_domains` + config central-DB URL),
  and ORM-delegation contract (subprocess to `prisma migrate deploy` / Lucid `migration:run`).
- Then `list`, `create`, `migrate`, `migrate:central`, `run`, `install`.

## Boundaries

- No new runtime dependency (readline is built-in). No network or DB access in Phase A.
- Interactivity is confined to `bin.ts`; `runCli`/plan/detection stay pure and unit-testable.
- Reuse F-005's change-plan/apply/security (containment, symlink rejection, staged writes); do not
  reimplement file writing.
- Do not touch accepted ADRs; Phase B decisions get new ADRs, not edits to old ones.
