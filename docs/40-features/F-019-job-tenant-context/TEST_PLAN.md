# Test Plan: Job Tenant Context

## Unit Tests

`packages/core/test/job-context.test.ts`:

- Capture in a tenant scope, exit the scope, then restore and confirm `getTenantOrFail()` returns the
  same tenant (the queue-boundary round-trip).
- Snapshot survives `JSON.parse(JSON.stringify(...))` and still restores.
- Capture + restore the central scope; `getTenantOrFail()` inside the restored central scope throws.
- `captureTenancy` outside any scope throws `TenantContextError`.

## Integration Tests

- N/A — the primitive is queue-agnostic and fully covered by the ALS round-trip unit tests.

## Security Tests

- Fail-closed capture: no scope → throw (never a silent unscoped snapshot). Central restore is not a
  tenant scope (tenant access throws), so a job can't accidentally read tenant data in central mode.
