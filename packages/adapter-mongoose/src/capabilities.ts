import {
  databaseEnforcedCapabilities,
  type TenancyAdapterCapabilities,
} from "tenancyjs-core";

export const MONGOOSE_ADAPTER_CAPABILITIES: Readonly<TenancyAdapterCapabilities> =
  Object.freeze({
    rowLevel: "supported",
    schemaPerTenant: "rejected",
    databasePerTenant: "supported",
    centralModels: "supported",
    transactions: "supported",
    nestedReads: "rejected",
    nestedWrites: "rejected",
    rawQueries: "rejected",
  });

/**
 * database-per-tenant is database-enforced (the leased Connection is the
 * tenant's own database), so nested reads/writes and raw queries are safe and
 * exposed via `client.unrestricted()`. Row-level Mongoose stays facade-enforced
 * — MongoDB has no row-level backstop (ADR-0033).
 */
export function mongooseCapabilities(
  strategy: "rowLevel" | "databasePerTenant",
): TenancyAdapterCapabilities {
  return strategy === "databasePerTenant"
    ? databaseEnforcedCapabilities(MONGOOSE_ADAPTER_CAPABILITIES)
    : MONGOOSE_ADAPTER_CAPABILITIES;
}
