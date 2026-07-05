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
  return runtime;
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
