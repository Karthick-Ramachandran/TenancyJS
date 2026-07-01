# Persist OS Commands

This document records the Persist OS commands available to humans and AI agents.

## Completion Gate

Before claiming implementation work is complete, run:

```txt
pnpm test:run
pnpm typecheck
persist doctor
```

If `persist doctor` reports errors, fix them or report why they cannot be fixed. If it reports
warnings, address them or record why they are acceptable.

Package binary behavior is covered by binary integration tests.

## Commands

### `persist init`

Initialize neutral repository memory.

Options:

- `--preset <id>`: apply optional preset guidance and proposed decisions.
- `--ai-tools <list>`: comma-separated AI tools to generate files for (`claude`, `codex`, `cursor`,
  `generic`). Default: `claude,codex,cursor` (all). `AGENTS.md` is always generated. Stored in
  `.persist/config.json` as `aiTools`.
- `--dry-run`: show planned writes without writing files.
- `--force`: overwrite existing files explicitly.
- `--reinit`: required with `--force` to overwrite an existing Persist OS installation
  (a directory that already has `.persist/config.json`). Without it, `--force` refuses, protecting
  existing repository memory.

Init also generates tracked pre-commit and pre-push hooks at `.persist/hooks/` that run `persist doctor`
plus any `preCommitGates` in `.persist/config.json`. The pre-push hook is the final regression gate
before code leaves the machine (it catches commits made with `--no-verify` or before the hook was
active). Init proposes, but does not run, the activation command `git config core.hooksPath .persist/hooks`.

### `persist adopt`

Inspect an existing repository through read-only manifest and marker files, then write a proposed
adoption report and proposed framework ADRs for human review. Adopt never executes repository code
and never produces accepted memory.

Options:

- `--dry-run`: show planned writes without writing files.
- `--force`: overwrite existing files explicitly.

### `persist skill create <name>`

Generate a portable AI agent skill as `SKILL.md` for both Claude Code (`.claude/skills/`) and the
portable Agent Skills target (`.agents/skills/`). Known names use the built-in catalog; unknown names
produce a valid skeleton. Generated skills contain no scripts.

Options:

- `--dry-run`: show planned writes without writing files.
- `--force`: overwrite existing files explicitly.

### `persist skill list`

List the built-in catalog skills.

### `persist mcp add <server>`

Generate offline, proposed memory for an MCP server (for example `figma`) as `docs/ai/mcp/<server>.md`
plus a proposed adoption ADR. Persist OS never connects to the MCP server or makes network calls; the
agent records durable MCP-derived context into the generated memory for human review. It also
installs a `capture-mcp-context` agent skill that prompts the agent to record that context.

Options:

- `--dry-run`: show planned writes without writing files.
- `--force`: overwrite existing files explicitly.

### `persist preset list`

List built-in presets.

### `persist feature create <name>`

Create feature memory docs under the configured features directory.

Options:

- `--dry-run`: show planned writes without writing files.
- `--force`: overwrite existing files explicitly.

### `persist adr create <title>`

Create a proposed ADR under the configured ADR directory.

Options:

- `--dry-run`: show planned writes without writing files.
- `--force`: overwrite existing files explicitly.

### `persist adr accept <name>`

Promote a proposed ADR to accepted repository memory. A proposal under
`docs/adrs/proposed/ADR-PROPOSED-<slug>.md` becomes a numbered, accepted `ADR-####-<slug>.md` and the
proposal is removed; an existing numbered Proposed ADR is accepted in place.

Options:

- `--dry-run`: show planned writes without writing files.
- `--force`: overwrite existing files explicitly.

### `persist adr supersede <old> <new-title>`

Record a changed decision. Marks an accepted ADR as `Accepted — superseded by ADR-####` and creates a
new accepted ADR that declares what it supersedes, so the reasoning trail stays auditable instead of
being overwritten. Doctor then warns about any memory still referencing the superseded decision.

Options:

- `--dry-run`: show planned writes without writing files.
- `--force`: overwrite existing files explicitly.

### `persist module create <name>`

Create module memory docs under the configured modules directory.

Options:

- `--dry-run`: show planned writes without writing files.
- `--force`: overwrite existing files explicitly.

### `persist doctor`

Check whether repository memory is structurally healthy enough for AI-assisted work, whether basic
engineering evidence is present, and whether memory references decisions that exist and are accepted.

Doctor also runs deterministic drift checks: feature or module memory that references a missing ADR
is an error, memory that references a not-yet-accepted ADR is a warning, and memory that still
references a superseded decision is a warning. Inside a git repository it also flags memory whose
referenced `src/` code changed long after the memory did (staleness), and it warns when the
always-loaded agent files grow past a context budget.

Exit codes:

- `0`: healthy
- `1`: warnings only
- `2`: errors

### `persist guard`

Fail when staged source changes have no accompanying test changes, so "tests are mandatory for every
change" is enforced rather than hoped for. Deterministic and read-only (a `git diff`); it only acts
when told what counts as source, and skips gracefully outside a git repository.

Options:

- `--source <list>`: comma-separated source directories to guard, e.g. `src,app`.
- `--base <ref>`: compare against a git ref instead of the staged index.

Add it to your gates to enforce it in the generated hooks, for example set `preCommitGates` in
`.persist/config.json` to include `persist guard --source src`. Exit code `1` blocks the commit/push
when source changed without tests; `0` otherwise.
