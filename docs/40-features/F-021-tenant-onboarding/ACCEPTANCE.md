# Acceptance Criteria: Tenant Onboarding

## Criteria

- `onboardTenant(runtime, input)` calls `store.create`, then `provisioner.provision`, then
  `provisioner.migrate`, in that order, and returns the created tenant.
- With no provisioner (row-level) it only records the tenant; with no `migrate` hook it records +
  provisions.
- If provisioning or migration throws, it best-effort `deprovision`s and `delete`s the tenant, then
  rethrows the original error (migrate is not run after a provision failure).
- Throws `TenantStoreContractError` when the runtime has no store.

## Out Of Scope

- Auth/billing/email; distributed transactions; database-engine provisioning.
