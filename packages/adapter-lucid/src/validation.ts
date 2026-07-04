import {
  validatePostgresRlsPolicies,
  type PostgresExecutor,
} from "@tenancyjs/adapter-shared";
import type {
  TenancyAdapterValidationResult,
  TenantRecord,
} from "@tenancyjs/core";

import type { LucidTenancyConfig } from "./config.js";
import { LUCID_CENTRAL_SETTING, LUCID_TENANT_SETTING } from "./config.js";

export async function validateLucidPolicies<TTenant extends TenantRecord>(
  config: LucidTenancyConfig<TTenant>,
): Promise<TenancyAdapterValidationResult> {
  return validatePostgresRlsPolicies({
    codePrefix: "TENANCY_LUCID",
    adapterName: "Lucid",
    execute: ((sql, bindings) =>
      bindings === undefined
        ? config.database.rawQuery(sql)
        : config.database.rawQuery(sql, [
            ...bindings,
          ])) satisfies PostgresExecutor,
    tables: config.tenantModels.map((model) => ({
      ...model,
      schema: model.schema!,
    })),
    tenantSetting: LUCID_TENANT_SETTING,
    centralSetting: LUCID_CENTRAL_SETTING,
  });
}
