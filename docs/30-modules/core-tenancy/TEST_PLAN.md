# Module Test Plan: Core Tenancy

## Unit Tests

- Empty, tenant, and central context lookup and typed failures.
- Nested same-tenant, different-tenant, tenant-to-central, and central-to-tenant scopes.
- Parallel scopes over promises, timers, microtasks, thrown errors, and rejected promises.
- Bootstrap order, reverse revert order, partial bootstrap failure, callback failure, and revert failure.
- Event ordering and listener failure semantics.

## Integration Tests

- Run the public core contract from a package-consumer fixture.
- Execute the shared lifecycle contract through a minimal fake integration and fake adapter.
- Verify supported Node.js versions and ESM/type exports.

## Security Tests

- Missing context fails closed; resolver failure cannot become central context.
- Request-controlled values cannot activate central scope or unsafe bypass.
- Context never leaks between concurrent callbacks or after completion.
- Tenant objects are immutable from consumers and lifecycle listeners.
- Cleanup and rollback occur on every injected failure path.

## Current Evidence

- 24 tests pass across workspace and core suites.
- Core source coverage: 100% statements, functions, and lines; 94.11% branches.
- The packed tarball installs with scripts disabled into a fresh temporary consumer and executes the
  public `TenancyManager` and `defineConfig` APIs.
- Node 22/24 CI remains required when this change is pushed.
