import { TenantStoreContractError } from "./errors.js";
import type { MaybePromise, TenantRecord } from "./types.js";

/**
 * The input a host store accepts when creating a tenant. All tenant fields
 * except `id` are supplied by the caller; `id` is optional because the store
 * may generate it. The store owns persistence — TenancyJS never assumes a
 * schema or table (ADR-0028).
 */
export type TenantStoreCreateInput<
  TTenant extends TenantRecord = TenantRecord,
> = Omit<TTenant, "id"> & { readonly id?: string };

/**
 * Bring-your-own tenant registry contract (ADR-0028). Every method is optional
 * so a store can implement only what it supports; a command that needs an
 * absent method fails with a clear "not supported by your store" error rather
 * than crashing. Returned records carry `id` plus whatever host fields the
 * store persists (slug, domains, status, placement).
 */
export interface TenantStore<TTenant extends TenantRecord = TenantRecord> {
  list?(): MaybePromise<readonly TTenant[]>;
  find?(id: string): MaybePromise<TTenant | null>;
  create?(input: TenantStoreCreateInput<TTenant>): MaybePromise<TTenant>;
  suspend?(id: string): MaybePromise<TTenant>;
  activate?(id: string): MaybePromise<TTenant>;
  delete?(id: string): MaybePromise<void>;
}

/** A store guaranteed to expose `method`, narrowed to a required callable. */
type RequiredStoreMethod<
  TTenant extends TenantRecord,
  TMethod extends keyof TenantStore<TTenant>,
> = TenantStore<TTenant> & {
  [K in TMethod]-?: NonNullable<TenantStore<TTenant>[K]>;
};

/**
 * Assert that a store implements `method`, returning it narrowed so the method
 * is callable without a further guard. Fail-closed: an absent method is a
 * configuration error surfaced to the operator, never a runtime crash.
 */
export function requireStoreMethod<
  TTenant extends TenantRecord,
  TMethod extends keyof TenantStore<TTenant>,
>(
  store: TenantStore<TTenant>,
  method: TMethod,
): RequiredStoreMethod<TTenant, TMethod> {
  if (typeof store[method] !== "function") {
    throw new TenantStoreContractError(
      `This command needs "${String(method)}", but your configured tenant store does not implement it.`,
      "TENANCY_STORE_METHOD_UNSUPPORTED",
      String(method),
    );
  }
  return store as RequiredStoreMethod<TTenant, TMethod>;
}

function assertTenantShape(
  value: unknown,
  method: string,
): asserts value is TenantRecord {
  if (
    value === null ||
    typeof value !== "object" ||
    typeof (value as { id?: unknown }).id !== "string" ||
    (value as { id: string }).id.length === 0
  ) {
    throw new TenantStoreContractError(
      `Your tenant store's "${method}" returned a value that is not a tenant (an object with a non-empty string id).`,
      "TENANCY_STORE_INVALID_TENANT",
      method,
    );
  }
}

function assertIdMatches(
  tenant: TenantRecord,
  requestedId: string,
  method: string,
): void {
  if (tenant.id !== requestedId) {
    throw new TenantStoreContractError(
      `Your tenant store's "${method}" was asked for tenant "${requestedId}" but returned "${tenant.id}". ` +
        "Refusing to act on a mismatched tenant.",
      "TENANCY_STORE_ID_MISMATCH",
      method,
    );
  }
}

/**
 * Wrap a host store so every result is validated at the boundary (ADR-0028):
 * `find`/`suspend`/`activate` must return the tenant that was asked for,
 * `list` must return unique ids, and every returned record must be a real
 * tenant. This is what makes bring-your-own safe — a buggy store that would
 * otherwise hand back the wrong tenant is caught here, fail-closed, instead of
 * leaking one tenant's data under another's identity.
 */
export function hardenTenantStore<TTenant extends TenantRecord>(
  store: TenantStore<TTenant>,
): TenantStore<TTenant> {
  const hardened: TenantStore<TTenant> = {};
  if (typeof store.list === "function") {
    hardened.list = async () => {
      const tenants = await store.list!();
      const seen = new Set<string>();
      for (const tenant of tenants) {
        assertTenantShape(tenant, "list");
        if (seen.has(tenant.id)) {
          throw new TenantStoreContractError(
            `Your tenant store's "list" returned tenant id "${tenant.id}" more than once.`,
            "TENANCY_STORE_DUPLICATE_ID",
            "list",
          );
        }
        seen.add(tenant.id);
      }
      return tenants;
    };
  }
  if (typeof store.find === "function") {
    hardened.find = async (id: string) => {
      const tenant = await store.find!(id);
      if (tenant === null) return null;
      assertTenantShape(tenant, "find");
      assertIdMatches(tenant, id, "find");
      return tenant;
    };
  }
  if (typeof store.create === "function") {
    hardened.create = async (input: TenantStoreCreateInput<TTenant>) => {
      const tenant = await store.create!(input);
      assertTenantShape(tenant, "create");
      if (input.id !== undefined) assertIdMatches(tenant, input.id, "create");
      return tenant;
    };
  }
  for (const method of ["suspend", "activate"] as const) {
    if (typeof store[method] === "function") {
      hardened[method] = async (id: string) => {
        const tenant = await store[method]!(id);
        assertTenantShape(tenant, method);
        assertIdMatches(tenant, id, method);
        return tenant;
      };
    }
  }
  if (typeof store.delete === "function") {
    hardened.delete = (id: string) => store.delete!(id);
  }
  return Object.freeze(hardened);
}
