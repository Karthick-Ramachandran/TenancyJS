import {
  databaseEnforcedCapabilities,
  type TenancyAdapterCapabilities,
} from "tenancyjs-core";

export const KNEX_ADAPTER_CAPABILITIES = Object.freeze({
  rowLevel: "supported",
  schemaPerTenant: "supported",
  databasePerTenant: "supported",
  centralModels: "supported",
  transactions: "supported",
  nestedReads: "rejected",
  nestedWrites: "rejected",
  rawQueries: "rejected",
} as const satisfies TenancyAdapterCapabilities);

/**
 * Capabilities depend on the configured strategy's enforcement tier (ADR-0033).
 * database-per-tenant is database-enforced by construction (the connection is
 * the tenant's own database), so nested reads/writes and raw queries are safe —
 * exposed via `client.unrestricted()`. Every other Knex strategy stays
 * facade-enforced (query-shape restrictions) until its tier earns an adversarial
 * test.
 */
export function knexCapabilities(
  strategy: "rowLevel" | "schemaPerTenant" | "databasePerTenant",
): TenancyAdapterCapabilities {
  return strategy === "databasePerTenant"
    ? databaseEnforcedCapabilities(KNEX_ADAPTER_CAPABILITIES)
    : KNEX_ADAPTER_CAPABILITIES;
}
