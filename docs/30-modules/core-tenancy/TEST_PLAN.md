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
