# Acceptance Criteria: CLI v0.1

## Criteria (Phase A)

- `tenancy init` prints a banner listing supported stacks (Express 5.2 + Prisma 7.8, AdonisJS 7.3 +
  Lucid 22.4, Next.js + Prisma 7.8), what is not supported (other frameworks/ORMs, MongoDB), and the
  Node >= 24 requirement.
- Running `init` on Node < 24 stops with a friendly message naming the required and current versions,
  and exits non-zero without writing files.
- On an interactive TTY where the framework is not cleanly detected, `init` presents a numbered,
  **mandatory** framework selection (Express / AdonisJS / Next.js); an empty or invalid entry re-prompts
  rather than proceeding. ORM is derived from the choice.
- When the framework is cleanly auto-detected and supported, `init` confirms it and does not force an
  unnecessary prompt.
- `--framework=<express|adonis|next>` (and `--yes`) fully skip prompting. `--json` and non-TTY input
  never prompt; if the framework is unresolved they emit a friendly error that names `--framework` and
  exits non-zero.
- `tenancy init` scaffolds the correct row-level template set for each of the three stacks; Next.js +
  Prisma produces a working, buildable wiring (verified by the existing example's shape).
- Error output is friendly in human mode and still carries a stable `code` in `--json` mode; secrets and
  database URLs remain redacted.
- `init` remains dry-run by default; `--apply` writes; conflict/symlink/containment protections from
  F-005 are unchanged.

## Out Of Scope

- Phase B commands (`list`, `create`, `migrate*`, `run`, `install`) — tracked separately with their own
  acceptance once the tenant-registry and ORM-delegation ADRs are accepted.
- Strategy selection beyond `rowLevel` (only strategy implemented); shown as fixed with others noted as
  roadmapped.
