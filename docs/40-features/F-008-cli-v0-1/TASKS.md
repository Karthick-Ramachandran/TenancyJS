# Tasks: CLI v0.1

## T1: Next.js detection + templates

Status: Done

Scope:
- Add `next` framework detection (version-gated) and `NEXT_PRISMA_TEMPLATES`; wire `plan.ts`.

Acceptance:
- `detectProject` reports `framework: next` for a Next 16 + Prisma 7.8 fixture; `init` scaffolds the
  Next wiring.

Tests:
- Detection unit test; plan/template test asserting the Next file set.

## T2: Interactive `CliIo` + readline prompts

Status: Done

Scope:
- Extend `CliIo` with `isInteractive` and injected `select`/`confirm`; implement real prompts in
  `bin.ts` via `node:readline/promises`.

Acceptance:
- Scripted answers drive `init` in tests; mandatory select re-prompts on empty/invalid input.

Tests:
- `runCli` with a scripted prompter selecting each framework; invalid-then-valid re-prompt.

## T3: Capability + Node banner and version gate

Status: Done

Scope:
- `capabilities.ts` supported matrix + Node floor; `init` prints banner and stops friendly on Node < 24.

Acceptance:
- Banner lists supported/unsupported + Node >= 24; sub-24 stop is friendly and non-zero, writes nothing.

Tests:
- Banner content assertion; simulated low Node version path.

## T4: Friendly errors + resolution order + help

Status: Done

Scope:
- Human error layer (codes preserved in `--json`); flag > detection > prompt resolution; non-interactive
  friendly "pass --framework" error; updated help.

Acceptance:
- All ACCEPTANCE Phase A criteria pass; secrets/URLs still redacted.

Tests:
- Non-interactive unresolved -> friendly error naming `--framework`; `--framework` skips prompt; `--json`
  error shape retains `code`.

Do Not:
- Start Phase B (tenant registry / migrate / run) before its ADRs are accepted.
