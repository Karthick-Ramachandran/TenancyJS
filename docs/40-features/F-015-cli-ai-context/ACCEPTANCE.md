# Acceptance Criteria: CLI AI Context

## Criteria

- `tenancy init --apply --ai-context` writes a `TENANCY.md` whose heading names the resolved stack
  (e.g. "Express + Prisma") and includes the everyday `tenancy` commands and doc links.
- When `AGENTS.md` or `CLAUDE.md` exists, the run injects exactly one `<!-- tenancyjs:start -->…<!--
  tenancyjs:end -->` block; re-running does not duplicate it (idempotent, replace-in-place) and
  preserves the file's other content.
- When neither agent-memory file exists, no such file is created and the CLI prints a hint to paste
  the block manually.
- Without `--ai-context` and without an interactive "yes", no `TENANCY.md` is written (opt-in only).
- Interactive `init --apply` prompts a yes/no question mentioning `TENANCY.md`; "yes" writes it, "no"
  skips it.
- `--json` output includes an `aiContext` summary (`guide` status + touched memory files) only when
  opted in; the flag is rejected on non-init commands.
- Symlinked or root-escaping `TENANCY.md`/agent-memory paths fail closed, consistent with init.

## Out Of Scope

- Fetching or updating the guide from the network.
- A standalone regenerate command.
- Editing agent-memory files that do not already exist.
