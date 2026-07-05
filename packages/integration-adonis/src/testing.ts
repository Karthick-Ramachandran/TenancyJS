import type { MaybePromise, TenantRecord } from "tenancyjs-core";

import type { AdonisTenancyConfig } from "./types.js";

/**
 * Run a test body inside tenant context and the Lucid managed transaction, using
 * the same application-owned manager and Lucid tenancy service the middleware
 * uses. Tenant context unwinds automatically once the callback settles, and a
 * thrown assertion rolls back the transaction — the same composition the
 * request middleware relies on. Framework-neutral: usable from Japa or any
 * runner without a test-runner dependency.
 */
export function withTenant<TTenant extends TenantRecord, TResult>(
  config: AdonisTenancyConfig<TTenant>,
  tenant: TTenant,
  callback: () => MaybePromise<TResult>,
): Promise<TResult> {
  return config.manager.runWithTenant(tenant, () =>
    config.tenancy.run(() => callback()),
  );
}
