import type { TenancyAdapter } from "./adapter.js";
import { InvalidTenancyRuntimeError } from "./errors.js";
import { hardenTenantStore, type TenantStore } from "./tenant-store.js";
import { TenancyManager } from "./tenancy-manager.js";
import type { MaybePromise, TenantRecord } from "./types.js";

const RUNTIME_BRAND: unique symbol = Symbol.for("tenancyjs.runtime");

/**
 * Per-tenant provisioning hooks the operational CLI delegates to for
 * schema/database-per-tenant (ADR-0029). The host wraps its own ORM/tooling in
 * these; the CLI orchestrates (resolve tenants + placement, run per-tenant,
 * fail-closed) but never invokes an ORM itself. All optional; a command whose
 * hook is absent fails closed with a clear message rather than a silent no-op.
 */
export interface TenancyProvisioner<
  TTenant extends TenantRecord = TenantRecord,
> {
  /** Create the tenant's schema/database. */
  provision?(tenant: TTenant): MaybePromise<void>;
  /** Drop the tenant's schema/database. */
  deprovision?(tenant: TTenant): MaybePromise<void>;
  /** Run the host's migrator against the tenant's placement. */
  migrate?(tenant: TTenant): MaybePromise<void>;
}

/** What a host passes to {@link defineTenancyRuntime}. */
export interface TenancyRuntimeInput<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly manager: TenancyManager<TTenant>;
  readonly store?: TenantStore<TTenant>;
  readonly adapters?: readonly TenancyAdapter[];
  readonly provisioner?: TenancyProvisioner<TTenant>;
  /** Closes connections/caches so the CLI process can exit; optional. */
  dispose?(): MaybePromise<void>;
}

/**
 * The single runtime contract the operational CLI reads (ADR-0027). A host's
 * `tenancy.config.ts` builds one of these; the CLI never reaches into framework
 * internals. `store` is returned hardened (ADR-0028).
 */
export interface TenancyRuntime<TTenant extends TenantRecord = TenantRecord> {
  readonly [RUNTIME_BRAND]: true;
  readonly manager: TenancyManager<TTenant>;
  readonly store?: TenantStore<TTenant>;
  readonly adapters: readonly TenancyAdapter[];
  readonly provisioner?: TenancyProvisioner<TTenant>;
  dispose(): Promise<void>;
}

/**
 * Build the runtime contract the operational CLI loads from a host's
 * `tenancy.config.ts`. Validates the essentials up front (a real
 * {@link TenancyManager} is required), hardens the tenant store so a buggy
 * store cannot hand back the wrong tenant, and normalises disposal so the CLI
 * always exits cleanly.
 */
export function defineTenancyRuntime<
  TTenant extends TenantRecord = TenantRecord,
>(input: TenancyRuntimeInput<TTenant>): TenancyRuntime<TTenant> {
  if (input === null || typeof input !== "object") {
    throw new InvalidTenancyRuntimeError(
      "defineTenancyRuntime requires a configuration object.",
    );
  }
  if (!(input.manager instanceof TenancyManager)) {
    throw new InvalidTenancyRuntimeError(
      "defineTenancyRuntime requires a `manager` created with new TenancyManager().",
    );
  }
  if (input.store !== undefined && typeof input.store !== "object") {
    throw new InvalidTenancyRuntimeError(
      "defineTenancyRuntime `store` must be an object implementing the TenantStore contract.",
    );
  }
  if (input.adapters !== undefined && !Array.isArray(input.adapters)) {
    throw new InvalidTenancyRuntimeError(
      "defineTenancyRuntime `adapters` must be an array of tenancy adapters.",
    );
  }
  const dispose = input.dispose;
  return Object.freeze({
    [RUNTIME_BRAND]: true as const,
    manager: input.manager,
    ...(input.store === undefined
      ? {}
      : { store: hardenTenantStore(input.store) }),
    adapters: Object.freeze([...(input.adapters ?? [])]),
    ...(input.provisioner === undefined
      ? {}
      : { provisioner: input.provisioner }),
    async dispose() {
      if (dispose !== undefined) await dispose();
    },
  });
}

/**
 * Narrow an arbitrary loaded value (e.g. a config module's export) to a
 * {@link TenancyRuntime}. Throws {@link InvalidTenancyRuntimeError} when the
 * value was not produced by {@link defineTenancyRuntime}.
 */
export function assertTenancyRuntime<
  TTenant extends TenantRecord = TenantRecord,
>(value: unknown): asserts value is TenancyRuntime<TTenant> {
  if (
    value === null ||
    typeof value !== "object" ||
    (value as { [RUNTIME_BRAND]?: unknown })[RUNTIME_BRAND] !== true
  ) {
    throw new InvalidTenancyRuntimeError(
      "Your tenancy config must export a runtime built with defineTenancyRuntime({ manager, store, adapters }).",
    );
  }
}
