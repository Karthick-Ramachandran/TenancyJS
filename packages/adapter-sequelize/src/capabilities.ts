import type { TenancyAdapterCapabilities } from "tenancyjs-core";

export const SEQUELIZE_ADAPTER_CAPABILITIES: Readonly<TenancyAdapterCapabilities> =
  Object.freeze({
    rowLevel: "supported",
    schemaPerTenant: "unsupported",
    databasePerTenant: "unsupported",
    centralModels: "supported",
    transactions: "supported",
    nestedReads: "rejected",
    nestedWrites: "rejected",
    rawQueries: "rejected",
  });
