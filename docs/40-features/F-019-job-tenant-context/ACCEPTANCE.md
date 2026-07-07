# Acceptance Criteria: Job Tenant Context

## Criteria

- `captureTenancy(manager)` inside a tenant scope returns `{ mode: "tenant", tenant }`; inside a central
  scope returns `{ mode: "central" }`; outside any scope throws `TenantContextError`.
- The snapshot is JSON-serializable: `JSON.parse(JSON.stringify(snapshot))` restores identically (proves
  it survives a real job payload).
- `runWithTenancySnapshot(manager, snapshot, cb)` runs `cb` inside the captured scope AFTER the original
  async scope has exited (the queue-boundary case): tenant snapshots re-enter `runWithTenant`, central
  snapshots re-enter `runInCentralContext`.
- A restored central snapshot is not a tenant: `getTenantOrFail()` inside it still throws (fail closed).

## Out Of Scope

- Queue-library auto-instrumentation; store re-validation on the worker; cache/storage helpers.
