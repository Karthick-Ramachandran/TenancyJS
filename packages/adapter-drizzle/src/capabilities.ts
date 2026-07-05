import {
  databaseEnforcedCapabilities,
  type TenancyAdapterCapabilities,
} from "tenancyjs-core";

export const DRIZZLE_ADAPTER_CAPABILITIES: Readonly<TenancyAdapterCapabilities> =
  Object.freeze({
    rowLevel: "supported",
    schemaPerTenant: "supported",
    databasePerTenant: "supported",
    centralModels: "supported",
    transactions: "supported",
    nestedReads: "rejected",
    nestedWrites: "rejected",
    rawQueries: "rejected",
  });

/**
 * database-per-tenant is database-enforced (the leased binding wraps the
 * tenant's own database), so nested reads/writes and raw queries are safe and
 * exposed via `client.unrestricted()`. Every other strategy stays
 * facade-enforced (ADR-0033).
 */
export function drizzleCapabilities(
  strategy: "rowLevel" | "schemaPerTenant" | "databasePerTenant",
): TenancyAdapterCapabilities {
  return strategy === "databasePerTenant"
    ? databaseEnforcedCapabilities(DRIZZLE_ADAPTER_CAPABILITIES)
    : DRIZZLE_ADAPTER_CAPABILITIES;
}
