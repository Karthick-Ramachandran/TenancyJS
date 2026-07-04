# Test Plan: CLI v0.1

## Unit Tests

- Detection: Next 16 + Prisma 7.8 fixture -> `framework: next`, `orm: prisma`, `supported: true`;
  unsupported Next version -> `supported: false`.
- Plan/templates: `init` for each stack (Express+Prisma, Adonis+Lucid, Next+Prisma) produces the
  expected file actions; Next set is buildable-shaped.
- Banner/capabilities: banner text lists the three supported stacks, the unsupported note, and Node >= 24.
- Node gate: injected low version -> friendly stop, non-zero, no file actions.
- Prompt resolution: scripted `select` chooses each framework; empty/invalid entry re-prompts then
  succeeds; `--framework` flag bypasses the prompt entirely.
- Non-interactive safety: `--json` / non-TTY with unresolved framework -> `CliUsageError` naming
  `--framework`; JSON error payload keeps a stable `code`.

## Integration Tests

- `runCli(["init", ...], io)` end-to-end with a scripted interactive `io` against a tmpdir fixture:
  dry-run then `--apply`, asserting created files and idempotent re-run.

## Security Tests

- Redaction still strips secrets/DB URLs from human and JSON output.
- Containment + symlink rejection from F-005 remain enforced for the new Next templates.
