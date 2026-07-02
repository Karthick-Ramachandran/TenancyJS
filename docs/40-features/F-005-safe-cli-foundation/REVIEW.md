# Review: Safe Cli Foundation

## Status

Local architecture, conventions, dependency, filesystem/process security, and completion review passed
without a blocker. Hosted CI follows after push.

## Findings

## Architecture Drift Review

- The package follows ADR-0001/ADR-0003: CLI analysis/templates remain separate from runtime packages;
  it reuses public package names and does not implement tenancy or ORM query behavior.
- The implementation owns only detection, plans, safe new-file writes, static diagnostics, and explicit
  local test execution. Migration/seed/database operations are not silently introduced.
- Runtime dependencies are Node built-ins only. No CLI framework, template engine, glob library, shell,
  or remote package runner was added.
- Feature/module/product/architecture/security/testing/conventions/lessons/changeset memory is updated.
  No undocumented architecture or dependency drift remains.

## Security Review

- Project root uses `realpath`; every plan/test path is relative and contained. Existing parents and
  destinations are checked with `lstat`, and symlinks, traversal, absolute paths, duplicates, and
  non-directory parents are rejected.
- `init` is preview-only without `--apply`. It never overwrites: differing files are conflicts, matching
  files are unchanged, staged content commits through exclusive hard links, and failures roll back all
  files/directories created by the operation.
- Doctor reads allowlisted metadata/source extensions, skips `.env`, VCS/dependencies/build/generated
  trees, source symlinks, and files over 1 MB. It never imports project modules or connects to a network
  or database.
- Error, JSON, human, and child output redact URL credentials and secret-like assignments. The explicit
  leak test receives only allowlisted database/test/Tenancy environment variables.
- `test:leak` accepts one canonical contained non-symlink `.js`/`.mjs`/`.cjs` file, invokes absolute
  `process.execPath` with an argument array and `shell: false`, and enforces a 120-second/1,000,000
  character default bound. The trusted test is explicitly not sandboxed.
- Tests cover malicious paths, symlink parents/files, conflicts, TOCTOU destination creation, rollback,
  `.env` canaries, redaction, environment filtering, timeouts, and binary exit behavior.

## Conventions Review

- `ProjectChangePlan` and `runDoctor` are recorded as canonical primitives. Existing `TenancyManager`,
  adapter, integration, and native-tool delegation vocabulary is not duplicated.
- Package naming, typed public APIs, stable finding codes, and runner-neutral deterministic results
  follow repository conventions.

## Accepted Tradeoffs

- New-file-only init avoids unsafe source transforms but requires manual integration into existing
  entry points and Prisma schemas.
- Static Doctor inventory is intentionally conservative and cannot prove runtime isolation.
- Node leak-test scripts are portable and shell-free but do not provide a sandbox; users must review the
  explicit file as trusted code.
- Initial compatibility remains Express 5.2 + Prisma 7.8 row-level on Node 22/24.
