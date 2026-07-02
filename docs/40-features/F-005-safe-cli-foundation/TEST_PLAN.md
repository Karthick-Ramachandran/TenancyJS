# Test Plan: Safe Cli Foundation

## Unit Tests

- Manifest/marker detection, unsupported versions, missing/invalid metadata, and no implicit project-code
  execution.
- Plan determinism, template content, conflict/unchanged classification, and redaction.
- Doctor findings and migration-effort calculation for base clients, raw APIs, relations, and missing
  model classification.

## Integration Tests

- Dry-run and apply against disposable Express/Prisma fixtures; repeat apply without changes.
- Binary human/JSON output and exit codes.
- Local JavaScript test delegation with pass/fail fake fixtures using direct Node execution.
- Packed CLI install/import/binary smoke test in a clean consumer.

## Security Tests

- Traversal, absolute path, symlink parent/destination, root escape, conflict, and interrupted commit.
- `.env` canary values never read or emitted; URL credentials and secret-like fields redact.
- No shell/remote runner and leak-test path must be contained, regular, JavaScript, and non-symlink.

## Skipped Lanes

- Database connectivity, migration delegates, other frameworks/ORMs, Windows, and database-per-tenant
  belong to later tasks and must not be claimed.
