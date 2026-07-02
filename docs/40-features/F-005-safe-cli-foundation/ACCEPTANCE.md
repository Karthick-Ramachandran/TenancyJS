# Acceptance Criteria: Safe Cli Foundation

## Criteria

- AC-CLI-REF-01: Detection reads only allowlisted metadata and identifies supported Express 5.2/Prisma
  7.8 projects with explicit unsupported/unknown results.
- AC-CLI-REF-02: `init` prints a typed plan by default, writes only with `--apply`, is idempotent, and
  never overwrites a differing existing file.
- AC-CLI-REF-03: Absolute paths, traversal, root escape, symlink destinations/parents, and staged-write
  failures are rejected with no partial generated installation.
- AC-CLI-REF-04: `doctor` checks required wiring, supported versions, secured-client adoption, raw and
  nested/relation usage, exhaustive model classification, and leak-test configuration.
- AC-CLI-REF-05: Human and JSON output use stable codes/severities, redact URL credentials and
  secret-valued fields, and return 0 healthy, 1 warnings, or 2 errors.
- AC-CLI-REF-06: `test:leak` accepts only an explicit contained non-symlink JavaScript test file,
  spawns Node directly with argument arrays, and preserves pass/fail exit evidence.
- AC-CLI-REF-07: Binary, fixture golden, repeated apply, malicious path/symlink, rollback, redaction,
  JSON schema, and clean package-consumer tests pass.
- AC-CLI-REF-08: Documentation clearly limits the foundation to Express + Prisma row-level projects
  and does not claim database connectivity or isolation merely from static Doctor results.

## Out Of Scope

- AC-CLI-03 migration/seed delegation and every non-reference framework/data layer.
- Automated changes to `package.json`, Prisma schema, application entry points, or existing files.
