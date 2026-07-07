# ADR-0040: Background Job Tenancy Snapshot Capture And Restore

## Status

Accepted

## Context

Tenant context rides `AsyncLocalStorage`, which does not survive a queue/timer/worker boundary. Code
that enqueues a job inside a tenant scope and processes it later runs the job **unscoped** — which
fails closed (throws) or, if the developer hand-threads the id wrong, could scope to the wrong tenant.
This is the most common real-app footgun once background jobs exist (BullMQ, pg-boss, cron). We need a
first-class, framework/queue-agnostic capture/restore so a job runs in the scope it was enqueued from.

## Decision

Add two functions to `tenancyjs-core`:

- `captureTenancy(manager): TenancySnapshot` — reads the active scope and returns a **JSON-serializable**
  snapshot (`{ mode: "central" }` or `{ mode: "tenant"; tenant }`). Throws `TenantContextError("missing")`
  when called outside any scope, so a forgotten scope fails loudly at enqueue time.
- `runWithTenancySnapshot(manager, snapshot, cb)` — the worker-side counterpart; re-enters
  `runInCentralContext` or `runWithTenant(snapshot.tenant)`.

The snapshot carries the **whole tenant record** (already a plain serializable object), so restore needs
no store lookup and works across process boundaries via the job payload.

## Alternatives Considered

- Capture only the tenant id + require a resolver on restore: more "live" (re-checks the store) but adds
  a required dependency and a per-job lookup. Deferred — a future opt-in `resolve` hook can add
  re-validation (suspended-tenant checks) without changing this base API.
- Auto-instrument popular queues (BullMQ, etc.): rejected — too many queues, too coupling; a small
  primitive the host wires into its own job (de)serialization is more portable.

## Consequences

- Improves: background jobs run in the correct tenant/central scope with two calls; the ALS-across-a-
  boundary footgun is closed with a fail-closed capture.
- Risks: the snapshot is a point-in-time copy of the tenant record (no re-validation on the worker) —
  acceptable for the base primitive; documented, with the resolver variant as a follow-up.

## Related Documents

- PRD: docs/40-features/F-019-job-tenant-context/PRD.md
- Feature: F-019-job-tenant-context
- Architecture: docs/10-architecture/ARCHITECTURE.md (AsyncLocalStorage context propagation)
