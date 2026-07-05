import type { TenancyAdapterCapabilities } from "./adapter.js";
import type { TenancyStrategy } from "./types.js";

/**
 * Enforcement tiers (ADR-0033).
 *
 * A scope is **database-enforced** when the connection or database itself
 * isolates every query — database-per-tenant leases the tenant's own database,
 * so raw SQL, joins, and nested reads/writes cannot reach another tenant. There
 * the facade's query-shape restrictions buy no safety, so they lift. Every other
 * scope is **facade-enforced**: the adapter facade is the only guard and the
 * restrictions hold, fail-closed.
 *
 * These two helpers are the only parts of that policy that are identical across
 * adapters, so they live here once. Each adapter keeps its own error class and,
 * critically, sets `databaseEnforced` from the actual leased-connection call
 * site — never derived from the strategy name (that derivation is a leak).
 */

/**
 * Lift the query-shape restrictions for a database-enforced scope: nested reads,
 * nested writes, and raw queries all become `supported`. Pass the adapter's base
 * (facade-enforced) capabilities; other fields are preserved.
 */
export function databaseEnforcedCapabilities(
  base: TenancyAdapterCapabilities,
): TenancyAdapterCapabilities {
  return Object.freeze({
    ...base,
    nestedReads: "supported",
    nestedWrites: "supported",
    rawQueries: "supported",
  });
}

/**
 * The message an adapter throws when full, raw query access is requested in a
 * scope that is not database-enforced. Kept in one place so every adapter
 * refuses with the same wording; the adapter supplies its own error class.
 */
export function unrestrictedRefusedMessage(context: {
  readonly adapter: string;
  readonly strategy: TenancyStrategy;
  readonly mode: "tenant" | "central";
}): string {
  return (
    "Full, raw query access is only available in a database-enforced scope — a database-per-tenant " +
    "scope running in tenant mode, where a per-tenant connection was actually leased and the connection " +
    `is the tenant's own database. The current ${context.adapter} scope (strategy=${context.strategy}, ` +
    `mode=${context.mode}) is facade-enforced, so full query access is refused (ADR-0033).`
  );
}
