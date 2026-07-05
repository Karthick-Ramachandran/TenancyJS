import {
  databaseEnforcedCapabilities,
  type TenancyAdapterCapabilities,
} from "tenancyjs-core";

export const LUCID_ADAPTER_CAPABILITIES = Object.freeze({
  rowLevel: "supported",
  schemaPerTenant: "supported",
  databasePerTenant: "supported",
  centralModels: "supported",
  transactions: "supported",
  nestedReads: "supported",
  nestedWrites: "rejected",
  rawQueries: "rejected",
} as const satisfies TenancyAdapterCapabilities);

/**
 * database-per-tenant is database-enforced (the leased connection is the
 * tenant's own database), so nested writes and raw queries are safe and reachable
 * via `scope.unrestricted()` (nested reads are already supported on the Lucid
 * facade). Every other strategy stays facade-enforced (ADR-0033).
 */
export function lucidCapabilities(
  strategy: "rowLevel" | "schemaPerTenant" | "databasePerTenant",
): TenancyAdapterCapabilities {
  return strategy === "databasePerTenant"
    ? databaseEnforcedCapabilities(LUCID_ADAPTER_CAPABILITIES)
    : LUCID_ADAPTER_CAPABILITIES;
}
