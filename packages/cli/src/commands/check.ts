import type { LoadedTenancyRuntime } from "../runtime-loader.js";

export type CheckStatus = "ok" | "warn" | "fail";

export interface TenantCheckItem {
  readonly name: string;
  readonly status: CheckStatus;
  readonly detail: string;
}

export interface TenantCheckResult {
  readonly schemaVersion: 1;
  readonly command: "tenant";
  readonly subcommand: "check";
  readonly healthy: boolean;
  readonly checks: readonly TenantCheckItem[];
}

const STORE_METHODS = [
  "list",
  "find",
  "create",
  "suspend",
  "activate",
  "delete",
] as const;

/**
 * `tenant check` — a read-only health probe of a loaded runtime (T7): confirms
 * the config produced a usable runtime, reports which store capabilities and
 * adapters are wired, and exercises a non-mutating `list()` read so a broken
 * store or connection surfaces here instead of mid-operation. Never mutates.
 */
export async function runTenantCheck(
  runtime: LoadedTenancyRuntime,
): Promise<TenantCheckResult> {
  const checks: TenantCheckItem[] = [
    { name: "runtime", status: "ok", detail: "tenancy config loaded" },
    {
      name: "adapters",
      status: "ok",
      detail: `${runtime.adapters.length} adapter(s) configured`,
    },
  ];

  if (runtime.store === undefined) {
    checks.push({
      name: "store",
      status: "warn",
      detail: "no tenant store configured — registry commands are unavailable",
    });
  } else {
    const store = runtime.store;
    const available = STORE_METHODS.filter(
      (method) => typeof store[method] === "function",
    );
    checks.push({
      name: "store",
      status: available.length > 0 ? "ok" : "warn",
      detail:
        available.length > 0
          ? `implements: ${available.join(", ")}`
          : "store present but implements no known methods",
    });
    checks.push(await probeList(store.list?.bind(store)));
  }

  const healthy = checks.every((check) => check.status !== "fail");
  return {
    schemaVersion: 1,
    command: "tenant",
    subcommand: "check",
    healthy,
    checks,
  };
}

async function probeList(
  list: (() => Promise<readonly { readonly id: string }[]>) | undefined,
): Promise<TenantCheckItem> {
  if (list === undefined) {
    return {
      name: "store.list",
      status: "warn",
      detail: "store does not implement list() — skipped read probe",
    };
  }
  try {
    const tenants = await list();
    return {
      name: "store.list",
      status: "ok",
      detail: `read ${tenants.length} tenant(s)`,
    };
  } catch (error) {
    return {
      name: "store.list",
      status: "fail",
      detail: error instanceof Error ? error.message : "read probe failed",
    };
  }
}
