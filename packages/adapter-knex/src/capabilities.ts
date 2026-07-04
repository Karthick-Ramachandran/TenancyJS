import type { TenancyAdapterCapabilities } from "@tenancyjs/core";

export const KNEX_ADAPTER_CAPABILITIES = Object.freeze({
  rowLevel: "supported",
  databasePerTenant: "unsupported",
  centralModels: "supported",
  transactions: "supported",
  nestedReads: "rejected",
  nestedWrites: "rejected",
  rawQueries: "rejected",
} as const satisfies TenancyAdapterCapabilities);
