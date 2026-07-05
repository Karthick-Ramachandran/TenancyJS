import { access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { CliProjectError, CliUsageError } from "../errors.js";
import type {
  LoadedTenancyRuntime,
  LoadedTenantStore,
} from "../runtime-loader.js";

export type RunScope =
  | { readonly mode: "tenant"; readonly tenantId: string }
  | { readonly mode: "central" };

export interface RunScriptOptions {
  readonly root: string;
  readonly script: string;
  readonly scope: RunScope;
}

export interface RunScriptResult {
  readonly schemaVersion: 1;
  readonly command: "run";
  readonly script: string;
  readonly scope: RunScope;
}

/**
 * `tenancy run <script>` — execute a host script inside a resolved tenant (or
 * central) scope (ADR-0027). The script is imported *inside* the scope so its
 * top-level code and its optional default-exported function both see the active
 * tenant context. Fails closed: an unknown tenant, a missing script, or a
 * throwing script all abort without leaking an unscoped run.
 */
export async function runScript(
  runtime: LoadedTenancyRuntime,
  options: RunScriptOptions,
): Promise<RunScriptResult> {
  const scriptUrl = await resolveScript(options.root, options.script);
  const execute = async (): Promise<void> => {
    const module = (await import(scriptUrl)) as { default?: unknown };
    if (typeof module.default === "function") {
      await (module.default as () => unknown | Promise<unknown>)();
    }
  };

  if (options.scope.mode === "central") {
    await runtime.manager.runInCentralContext(execute);
  } else {
    const tenant = await resolveTenant(runtime, options.scope.tenantId);
    await runtime.manager.runWithTenant(tenant, execute);
  }

  return {
    schemaVersion: 1,
    command: "run",
    script: options.script,
    scope: options.scope,
  };
}

async function resolveScript(root: string, script: string): Promise<string> {
  const absolute = path.resolve(root, script);
  try {
    await access(absolute);
  } catch {
    throw new CliUsageError(
      `Script not found: ${script} (resolved to ${absolute}).`,
    );
  }
  return pathToFileURL(absolute).href;
}

async function resolveTenant(
  runtime: LoadedTenancyRuntime,
  id: string,
): Promise<{ readonly id: string }> {
  const store = requireStore(runtime);
  if (typeof store.find !== "function") {
    throw new CliProjectError(
      'Running inside a tenant scope needs "find", but your tenant store does not implement it.',
    );
  }
  const tenant = await store.find(id);
  if (tenant === null) {
    throw new CliProjectError(`No tenant found with id "${id}".`);
  }
  return tenant;
}

function requireStore(runtime: LoadedTenancyRuntime): LoadedTenantStore {
  if (runtime.store === undefined) {
    throw new CliProjectError(
      "Running inside a tenant scope needs a tenant store, but your tenancy config's runtime has none. " +
        "Pass `store` to defineTenancyRuntime, or use --central.",
    );
  }
  return runtime.store;
}
