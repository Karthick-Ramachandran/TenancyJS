import { CliProjectError } from "../errors.js";
import type {
  LoadedProvisioner,
  LoadedTenancyRuntime,
} from "../runtime-loader.js";

export type ProvisionAction = "provision" | "deprovision" | "migrate";

export interface ProvisionOutcome {
  readonly tenantId: string;
  readonly status: "ok" | "failed";
  readonly error?: string;
}

export interface ProvisionResult {
  readonly schemaVersion: 1;
  readonly command: "tenant";
  readonly subcommand: ProvisionAction;
  readonly ok: boolean;
  readonly results: readonly ProvisionOutcome[];
}

/**
 * `tenant provision|deprovision|migrate` — delegate per-tenant lifecycle to the
 * host's provisioner hooks (ADR-0029). The CLI resolves the tenant record (and
 * its placement) from the store and calls the hook; it never invokes an ORM
 * itself. Fail-closed: a missing provisioner or hook is a clear error, and each
 * tenant's outcome is reported so a partial `--all` run is never mistaken for a
 * clean one.
 */
export async function runProvisionAction(
  runtime: LoadedTenancyRuntime,
  action: ProvisionAction,
  target: { readonly id: string } | { readonly all: true },
): Promise<ProvisionResult> {
  const hook = requireHook(runtime, action);
  const tenants = await resolveTargets(runtime, target);

  const results: ProvisionOutcome[] = [];
  for (const tenant of tenants) {
    try {
      await hook(tenant);
      results.push({ tenantId: tenant.id, status: "ok" });
    } catch (error) {
      results.push({
        tenantId: tenant.id,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    schemaVersion: 1,
    command: "tenant",
    subcommand: action,
    ok: results.every((result) => result.status === "ok"),
    results,
  };
}

function requireHook(
  runtime: LoadedTenancyRuntime,
  action: ProvisionAction,
): (tenant: { readonly id: string }) => Promise<void> {
  const provisioner = runtime.provisioner;
  if (provisioner === undefined) {
    throw new CliProjectError(
      `This command needs a provisioner, but your tenancy config's runtime has none. ` +
        `Pass \`provisioner\` with a ${action}() hook to defineTenancyRuntime.`,
    );
  }
  const hook = provisioner[action as keyof LoadedProvisioner];
  if (typeof hook !== "function") {
    throw new CliProjectError(
      `Your runtime's provisioner does not implement a ${action}() hook.`,
    );
  }
  return hook.bind(provisioner) as (tenant: {
    readonly id: string;
  }) => Promise<void>;
}

async function resolveTargets(
  runtime: LoadedTenancyRuntime,
  target: { readonly id: string } | { readonly all: true },
): Promise<readonly { readonly id: string }[]> {
  if (runtime.store === undefined) {
    throw new CliProjectError(
      "This command needs a tenant store to resolve tenants, but your runtime has none.",
    );
  }
  const store = runtime.store;
  if ("all" in target) {
    if (typeof store.list !== "function") {
      throw new CliProjectError(
        'Running against all tenants needs "list", but your tenant store does not implement it.',
      );
    }
    return store.list();
  }
  if (typeof store.find !== "function") {
    throw new CliProjectError(
      'Resolving a tenant needs "find", but your tenant store does not implement it.',
    );
  }
  const tenant = await store.find(target.id);
  if (tenant === null) {
    throw new CliProjectError(`No tenant found with id "${target.id}".`);
  }
  return [tenant];
}
