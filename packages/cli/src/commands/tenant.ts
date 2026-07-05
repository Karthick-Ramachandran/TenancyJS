import { CliProjectError, CliUsageError } from "../errors.js";
import type {
  LoadedTenantStore,
  LoadedTenancyRuntime,
} from "../runtime-loader.js";

/** A tenant record as returned by the host store: an id plus arbitrary fields. */
export type TenantRecordView = Readonly<Record<string, unknown>> & {
  readonly id: string;
};

export interface TenantListResult {
  readonly schemaVersion: 1;
  readonly command: "tenant";
  readonly subcommand: "list";
  readonly count: number;
  readonly tenants: readonly TenantRecordView[];
}

export interface TenantShowResult {
  readonly schemaVersion: 1;
  readonly command: "tenant";
  readonly subcommand: "show";
  readonly tenant: TenantRecordView;
}

/**
 * `tenant list` — read every tenant from the host store. The store returned by
 * the loaded runtime is already hardened (ADR-0028), so unique-id and shape
 * validation have run before we format anything.
 */
export async function runTenantList(
  runtime: LoadedTenancyRuntime,
): Promise<TenantListResult> {
  const store = requireStore(runtime);
  if (typeof store.list !== "function") {
    throw unsupported("list");
  }
  const tenants = (await store.list()) as readonly TenantRecordView[];
  return {
    schemaVersion: 1,
    command: "tenant",
    subcommand: "list",
    count: tenants.length,
    tenants,
  };
}

/** `tenant show <id>` — read a single tenant, erroring clearly when absent. */
export async function runTenantShow(
  runtime: LoadedTenancyRuntime,
  id: string,
): Promise<TenantShowResult> {
  if (typeof id !== "string" || id.length === 0) {
    throw new CliUsageError("tenant show requires a non-empty <id>.");
  }
  const store = requireStore(runtime);
  if (typeof store.find !== "function") {
    throw unsupported("find");
  }
  const tenant = (await store.find(id)) as TenantRecordView | null;
  if (tenant === null) {
    throw new CliProjectError(`No tenant found with id "${id}".`);
  }
  return {
    schemaVersion: 1,
    command: "tenant",
    subcommand: "show",
    tenant,
  };
}

function requireStore(runtime: LoadedTenancyRuntime): LoadedTenantStore {
  if (runtime.store === undefined) {
    throw new CliProjectError(
      "This command needs a tenant store, but your tenancy config's runtime has none. " +
        "Pass `store` to defineTenancyRuntime({ manager, store, adapters }).",
    );
  }
  return runtime.store;
}

function unsupported(method: string): CliProjectError {
  return new CliProjectError(
    `This command needs "${method}", but your configured tenant store does not implement it.`,
  );
}
