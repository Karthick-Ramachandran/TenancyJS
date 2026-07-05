# ADR-0016: Interactive Init Wizard And CLI IO Contract

## Status

Accepted

## Context

The F-005 CLI is argv-only and deterministic: `runCli(argv, io)` with `io = { cwd, writeStdout,
writeStderr }`, no stdin. When `init` cannot detect a supported framework/ORM it throws and effectively
tells the user to re-run with flags. The product owner wants the opposite: a helpful tool that **asks**
for the missing choice (mandatory selection), shows up front **what works, what does not, and the
required Node version**, and uses **friendly** error messages — without becoming untestable or pulling a
heavy dependency.

## Decision

1. **Interactive, mandatory selection instead of force-errors.** `init` resolves each required field
   (framework; ORM is derived) in this order: explicit flag > clean supported auto-detection >
   interactive selection. An interactive selection is **mandatory** — empty/invalid input re-prompts and
   never proceeds on a guess.
2. **CLI IO contract.** `CliIo` gains `isInteractive: boolean` and injected `select(question, choices)` /
   `confirm(question)`. The real binary (`bin.ts`) implements them with Node's built-in
   `node:readline/promises` over the TTY. Tests inject a scripted prompter. `runCli` and the
   detection/plan core remain pure and deterministic — interactivity lives only at the `bin.ts` edge.
3. **Zero new runtime dependency.** Prompts are built on the Node standard library; `tenancyjs-cli`
   keeps zero runtime dependencies. No prompt library is added.
4. **Non-interactive safety.** `--json`, `--yes`, and a non-TTY stdin never prompt. If a required field
   is unresolved in non-interactive mode, `init` emits a friendly error that names the exact flag to pass
   (`--framework`) and exits non-zero. Machine `code` fields are preserved under `--json`.
5. **Capability + Node banner.** `init` prints the supported matrix (Express 5.2 + Prisma 7.8, AdonisJS
   7.3 + Lucid 22.4, Next.js + Prisma 7.8), the unsupported note (other stacks, MongoDB), and the Node
   >= 24 requirement; it checks `process.versions.node` and stops friendly (non-zero, no writes) below 24.
6. **Friendly errors** everywhere in human mode, with codes retained for `--json`. Redaction and the
   F-005 apply safety (containment, symlink rejection, dry-run-by-default, `--apply`) are unchanged.

## Alternatives Considered

- **Keep force-errors (flags only).** Rejected: the owner explicitly wants prompts, not "re-run with
  `--framework`."
- **Adopt a prompt library (`@clack/prompts`, `enquirer`).** Rejected for v0.1: nicer visuals but adds a
  runtime dependency to vet/pin and complicates the pure-core test model; readline is sufficient.
- **Prompt directly from `runCli` via `process.stdin`.** Rejected: breaks determinism and testability;
  interactivity is injected through `CliIo` instead.

## Consequences

- Improves: first-run success ("no setup"), honesty (upfront capability + Node banner), and friendliness;
  no new dependency; core stays unit-testable via a scripted prompter.
- Worsens/risks: plainer prompt visuals than a library; interactive paths need scripted-IO tests and a
  TTY check so CI/non-TTY never blocks on a prompt. Mitigated by the non-interactive-safety rule.

## Related Documents

- PRD: docs/40-features/F-008-cli-v0-1/PRD.md
- Architecture: docs/40-features/F-008-cli-v0-1/ARCHITECTURE_IMPACT.md
- Security: docs/20-security/SECURITY_MODEL.md
- Feature: docs/40-features/F-008-cli-v0-1
