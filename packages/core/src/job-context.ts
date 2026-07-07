import { TenantContextError } from "./errors.js";
import type { TenancyManager } from "./tenancy-manager.js";
import type { MaybePromise, TenantRecord } from "./types.js";

/**
 * A serializable snapshot of the active tenancy scope. `AsyncLocalStorage`
 * context does NOT survive across a queue/timer boundary, so a background job
 * enqueued inside a tenant scope would otherwise run unscoped (and fail closed).
 * Capture a snapshot when you enqueue, put it in the job payload, and restore it
 * on the worker so the job runs in the same scope.
 */
export type TenancySnapshot<TTenant extends TenantRecord = TenantRecord> =
  Readonly<{ mode: "central" }> | Readonly<{ mode: "tenant"; tenant: TTenant }>;

/**
 * Capture the active tenancy scope as a JSON-serializable snapshot. Throws if
 * called outside any scope — you must be in a tenant or central context to
 * capture one (so a forgotten scope fails loudly instead of enqueuing unscoped
 * work).
 */
export function captureTenancy<TTenant extends TenantRecord = TenantRecord>(
  manager: TenancyManager<TTenant>,
): TenancySnapshot<TTenant> {
  const context = manager.getContext();
  if (context === undefined) throw new TenantContextError("missing");
  return context.mode === "central"
    ? Object.freeze({ mode: "central" as const })
    : Object.freeze({ mode: "tenant" as const, tenant: context.tenant });
}

/**
 * Restore a snapshot and run `callback` inside it — the worker-side counterpart
 * of {@link captureTenancy}. Re-enters `runWithTenant` or `runInCentralContext`,
 * so tenant-scoped data access inside the job is isolated exactly as it was when
 * the job was enqueued.
 */
export function runWithTenancySnapshot<
  TTenant extends TenantRecord = TenantRecord,
  TResult = unknown,
>(
  manager: TenancyManager<TTenant>,
  snapshot: TenancySnapshot<TTenant>,
  callback: () => MaybePromise<TResult>,
): Promise<TResult> {
  return snapshot.mode === "central"
    ? manager.runInCentralContext(callback)
    : manager.runWithTenant(snapshot.tenant, callback);
}
