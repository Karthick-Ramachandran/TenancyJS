# PRD: Job Tenant Context

## Purpose

Tenant context rides `AsyncLocalStorage`, which is lost across a queue/timer/worker boundary. So the
moment a real app adds background jobs (BullMQ, pg-boss, cron), a job enqueued inside a tenant scope runs
**unscoped** on the worker — it fails closed (throws) or, if the developer hand-threads the tenant id,
risks scoping to the wrong tenant. This is the top real-app footgun after setup and is pure friction
against "set up and just build" (see friction-reduction-roadmap). Provide a first-class capture/restore
so a job runs in the scope it was enqueued from, in two calls.

## In Scope

- `captureTenancy(manager)` → a JSON-serializable `TenancySnapshot` (`central` or `tenant` + record);
  throws when called outside any scope (fail closed at enqueue).
- `runWithTenancySnapshot(manager, snapshot, cb)` → re-enters `runWithTenant`/`runInCentralContext` on
  the worker.
- Framework/queue-agnostic; lives in `tenancyjs-core`.

## Non-Goals

- Auto-instrumenting specific queue libraries (BullMQ, etc.) — the host wires the two calls into its own
  job (de)serialization.
- Re-validating the tenant against the store on the worker (suspended-tenant re-check) — a future opt-in
  resolver variant (ADR-0040).
- Tenant-aware cache-key / storage-prefix helpers — trivial one-liners, out of scope here.
