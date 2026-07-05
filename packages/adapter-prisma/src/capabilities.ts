import type { TenancyAdapterCapabilities } from "tenancyjs-core";

export const PRISMA_ADAPTER_CAPABILITIES = Object.freeze({
  rowLevel: "supported",
  schemaPerTenant: "unsupported",
  databasePerTenant: "supported",
  centralModels: "supported",
  transactions: "supported",
  nestedReads: "rejected",
  nestedWrites: "rejected",
  rawQueries: "rejected",
} as const satisfies TenancyAdapterCapabilities);
