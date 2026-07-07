# Test Plan: Tenant Onboarding

## Unit Tests

`packages/core/test/onboard.test.ts`:

- Records → provisions → migrates in order; returns the tenant.
- Skips provisioning with no provisioner; skips migrate with no migrate hook.
- Rolls back (deprovision + delete) and rethrows when provision fails (migrate not run); rolls back when
  migrate fails.
- Throws `TenantStoreContractError` when the runtime has no store.

## Integration Tests

- N/A — composition over the store/provisioner contracts, fully covered by unit tests; the provisioners
  themselves have real-Postgres coverage (F-018).

## Security Tests

- Fail closed: no store → throw. A failed onboarding leaves nothing half-created (rollback), so a
  half-provisioned tenant can't linger and later resolve.
