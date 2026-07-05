import type { TenancyAdapterCapabilities } from "@tenancyjs/core";

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
