import { TenantStoreContractError } from "./errors.js";
import type { TenancyRuntime } from "./runtime.js";
import {
  requireStoreMethod,
  type TenantStoreCreateInput,
} from "./tenant-store.js";
import type { MaybePromise, TenantRecord } from "./types.js";

/**
 * Onboard a new tenant end to end from your signup handler: record it in your
 * store, provision its placement, and run its migrations — the same lifecycle
 * the CLI runs per tenant, in one call. If provisioning or migration fails, it
 * best-effort rolls back (deprovision + delete) so a failed onboarding leaves
 * nothing half-created, then rethrows the original error. Steps whose runtime
 * hook is absent (no provisioner for row-level, no `migrate`) are skipped.
 */
export async function onboardTenant<
  TTenant extends TenantRecord = TenantRecord,
>(
  runtime: TenancyRuntime<TTenant>,
  input: TenantStoreCreateInput<TTenant>,
): Promise<TTenant> {
  if (runtime.store === undefined) {
    throw new TenantStoreContractError(
      "onboardTenant needs a tenant store on the runtime to record the tenant.",
      "TENANCY_STORE_METHOD_UNSUPPORTED",
      "create",
    );
  }
  const store = requireStoreMethod(runtime.store, "create");
  const tenant = await store.create(input);
  try {
    await runtime.provisioner?.provision?.(tenant);
    await runtime.provisioner?.migrate?.(tenant);
  } catch (error) {
    // A failed onboarding must not leave a half-created tenant. Roll back
    // best-effort; cleanup failures never mask the original error.
    await bestEffort(() => runtime.provisioner?.deprovision?.(tenant));
    await bestEffort(() => runtime.store?.delete?.(tenant.id));
    throw error;
  }
  return tenant;
}

async function bestEffort(
  operation: () => MaybePromise<unknown>,
): Promise<void> {
  try {
    await operation();
  } catch {
    // Intentionally swallowed — the onboarding error is the one that matters.
  }
}
