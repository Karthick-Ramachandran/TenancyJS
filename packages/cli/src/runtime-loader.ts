import { access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { CliProjectError, CliUsageError } from "./errors.js";

/**
 * The runtime contract the operational CLI reads from a host's tenancy config
 * (ADR-0027). It mirrors `@tenancyjs/core`'s `TenancyRuntime` structurally so
 * the CLI stays zero-dependency; the brand below identifies it across package
 * versions via the global symbol registry.
 */
export interface LoadedTenancyRuntime {
  readonly manager: LoadedTenancyManager;
  readonly store?: LoadedTenantStore;
  readonly adapters: readonly LoadedAdapter[];
  readonly provisioner?: LoadedProvisioner;
  dispose(): Promise<void>;
}

export interface LoadedTenancyManager {
  runWithTenant<T>(
    tenant: { readonly id: string },
    callback: () => T | Promise<T>,
  ): Promise<T>;
  runInCentralContext<T>(callback: () => T | Promise<T>): Promise<T>;
  getContext(): unknown;
}

export interface LoadedTenantStore {
  list?(): Promise<readonly { readonly id: string }[]>;
  find?(id: string): Promise<{ readonly id: string } | null>;
  create?(input: Record<string, unknown>): Promise<{ readonly id: string }>;
  suspend?(id: string): Promise<{ readonly id: string }>;
  activate?(id: string): Promise<{ readonly id: string }>;
  delete?(id: string): Promise<void>;
}

export interface LoadedAdapter {
  readonly name: string;
  readonly strategy: string;
  /**
   * The adapter's own capability self-report (status per strategy). Its values
   * flip to "supported" only after a real adversarial test, so it is the honest
   * source of truth for what a stack has actually been verified to do.
   */
  readonly capabilities?: Readonly<Record<string, string>>;
}

export interface LoadedProvisioner {
  provision?(tenant: { readonly id: string }): Promise<void>;
  deprovision?(tenant: { readonly id: string }): Promise<void>;
  migrate?(tenant: { readonly id: string }): Promise<void>;
}

/** Matches `Symbol.for("tenancyjs.runtime")` set by `defineTenancyRuntime`. */
const RUNTIME_BRAND = Symbol.for("tenancyjs.runtime");

const DEFAULT_CONFIG_CANDIDATES = [
  "tenancy.config.ts",
  "tenancy.config.mts",
  "tenancy.config.mjs",
  "tenancy.config.js",
];

export interface LoadRuntimeOptions {
  readonly root: string;
  /** Explicit config path (relative to root or absolute); overrides discovery. */
  readonly configPath?: string;
}

/**
 * Resolve and load the host's tenancy runtime (ADR-0027). Node 24 strips
 * TypeScript types natively, so a `.ts` config imports with no transpiler
 * dependency. Fails closed with a clear, redactable message when the config is
 * missing, throws while loading, or does not export a `defineTenancyRuntime`
 * result.
 */
export async function loadTenancyRuntime(
  options: LoadRuntimeOptions,
): Promise<LoadedTenancyRuntime> {
  const resolved = await resolveConfigPath(options);
  let loaded: Record<string, unknown>;
  try {
    loaded = (await import(pathToFileURL(resolved).href)) as Record<
      string,
      unknown
    >;
  } catch (error) {
    throw new CliProjectError(
      `Failed to load tenancy config at ${configLabel(options.root, resolved)}: ${errorDetail(error)}`,
      { cause: error },
    );
  }
  const runtime = await resolveRuntimeExport(loaded, resolved, options.root);
  assertBrandedRuntime(runtime, resolved, options.root);
  // Defense in depth (ADR-0028): the runtime brand is a global-registry symbol
  // and therefore forgeable, and a config that hand-builds the branded object
  // never ran through core's hardenTenantStore. So the CLI re-hardens the store
  // at the enforcement boundary regardless — a wrong-tenant return is rejected
  // here even if the host skipped defineTenancyRuntime. Idempotent when already
  // hardened.
  if (runtime.store === undefined) return runtime;
  return { ...runtime, store: hardenLoadedStore(runtime.store) };
}

/**
 * Wrap a loaded store so its results are validated before any command acts on
 * them: `find`/`suspend`/`activate` must return the tenant that was asked for,
 * `list` must return unique well-formed tenants, and `create` must echo an
 * explicitly requested id. Mirrors `@tenancyjs/core`'s `hardenTenantStore`,
 * reimplemented here to keep the CLI zero-dependency. Fail-closed: a mismatch
 * throws rather than letting one tenant's data surface under another's id.
 */
function hardenLoadedStore(store: LoadedTenantStore): LoadedTenantStore {
  const hardened: LoadedTenantStore = {};
  if (typeof store.list === "function") {
    const list = store.list.bind(store);
    hardened.list = async () => {
      const tenants = await list();
      const seen = new Set<string>();
      for (const tenant of tenants) {
        assertTenantShape(tenant, "list");
        if (seen.has(tenant.id)) {
          throw new CliProjectError(
            `Your tenant store's "list" returned tenant id "${tenant.id}" more than once.`,
          );
        }
        seen.add(tenant.id);
      }
      return tenants;
    };
  }
  if (typeof store.find === "function") {
    const find = store.find.bind(store);
    hardened.find = async (id) => {
      const tenant = await find(id);
      if (tenant === null) return null;
      assertTenantShape(tenant, "find");
      assertIdMatches(tenant, id, "find");
      return tenant;
    };
  }
  if (typeof store.create === "function") {
    const create = store.create.bind(store);
    hardened.create = async (input) => {
      const tenant = await create(input);
      assertTenantShape(tenant, "create");
      if (typeof input.id === "string")
        assertIdMatches(tenant, input.id, "create");
      return tenant;
    };
  }
  for (const action of ["suspend", "activate"] as const) {
    const method = store[action];
    if (typeof method === "function") {
      const bound = method.bind(store);
      hardened[action] = async (id: string) => {
        const tenant = await bound(id);
        assertTenantShape(tenant, action);
        assertIdMatches(tenant, id, action);
        return tenant;
      };
    }
  }
  if (typeof store.delete === "function")
    hardened.delete = store.delete.bind(store);
  return hardened;
}

function assertTenantShape(
  value: unknown,
  method: string,
): asserts value is { readonly id: string } {
  if (
    value === null ||
    typeof value !== "object" ||
    typeof (value as { id?: unknown }).id !== "string" ||
    (value as { id: string }).id.length === 0
  ) {
    throw new CliProjectError(
      `Your tenant store's "${method}" returned a value that is not a tenant (an object with a non-empty string id).`,
    );
  }
}

function assertIdMatches(
  tenant: { readonly id: string },
  requestedId: string,
  method: string,
): void {
  if (tenant.id !== requestedId) {
    throw new CliProjectError(
      `Your tenant store's "${method}" was asked for tenant "${requestedId}" but returned "${tenant.id}". Refusing to act on a mismatched tenant.`,
    );
  }
}

async function resolveConfigPath(options: LoadRuntimeOptions): Promise<string> {
  if (options.configPath !== undefined) {
    const explicit = path.resolve(options.root, options.configPath);
    if (!(await exists(explicit))) {
      throw new CliUsageError(
        `Config file not found: ${options.configPath} (resolved to ${explicit}).`,
      );
    }
    return explicit;
  }
  for (const candidate of DEFAULT_CONFIG_CANDIDATES) {
    const absolute = path.resolve(options.root, candidate);
    if (await exists(absolute)) return absolute;
  }
  throw new CliProjectError(
    `No tenancy config found. Create a ${DEFAULT_CONFIG_CANDIDATES[0]} that exports ` +
      "defineTenancyRuntime({ manager, store, adapters }), or pass --config <path>.",
  );
}

async function resolveRuntimeExport(
  loaded: Record<string, unknown>,
  resolved: string,
  root: string,
): Promise<unknown> {
  const candidate =
    loaded.default ?? loaded.runtime ?? loaded.tenancy ?? loaded;
  // Support both an exported runtime and a factory returning one.
  if (typeof candidate === "function") {
    try {
      return await (candidate as () => unknown)();
    } catch (error) {
      throw new CliProjectError(
        `Your tenancy config at ${configLabel(root, resolved)} threw while building the runtime: ${errorDetail(error)}`,
        { cause: error },
      );
    }
  }
  return candidate;
}

function assertBrandedRuntime(
  value: unknown,
  resolved: string,
  root: string,
): asserts value is LoadedTenancyRuntime {
  if (
    value === null ||
    typeof value !== "object" ||
    (value as Record<symbol, unknown>)[RUNTIME_BRAND] !== true
  ) {
    throw new CliProjectError(
      `Your tenancy config at ${configLabel(root, resolved)} must export a runtime built with ` +
        "defineTenancyRuntime({ manager, store, adapters }) from @tenancyjs/core " +
        "(as the default export, or a named `runtime`/`tenancy` export).",
    );
  }
}

/** A short, human-friendly path for messages (relative to the project root). */
function configLabel(root: string, resolved: string): string {
  return path.relative(root, resolved);
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}
