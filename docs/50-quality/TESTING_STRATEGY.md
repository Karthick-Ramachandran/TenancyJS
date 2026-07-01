# Testing Strategy

Tests derive from feature acceptance criteria, module boundaries, and the security model.

The platform uses reusable conformance suites:

- Core contract tests cover nested async context, concurrency, central context, lifecycle ordering,
  error cleanup, and strict-mode failures.
- Adapter contract tests cover tenant-scoped create/read/update/delete/count/aggregate, bulk and nested
  operations, transactions, missing context, central models, and explicit bypass behavior.
- Framework integration tests prove context is initialized and always reverted across success, error,
  streaming, and concurrent requests.
- CLI golden tests cover detection and generated patches for supported framework/data-layer fixtures;
  binary tests cover exit codes, JSON output, dry runs, conflicts, and secret redaction.
- Example E2E tests prove two tenants cannot observe or mutate each other's records for every stable
  framework/data-layer combination.

The detailed matrix and release gates live in
`docs/40-features/F-001-tenancyjs-platform/TEST_PLAN.md`.
