import {
  validatePostgresRlsPolicies,
  type PostgresExecutor,
} from "tenancyjs-adapter-shared";
import type {
  TenancyAdapterValidationResult,
  TenantRecord,
} from "tenancyjs-core";

import type { KnexTenancyConfig } from "./config.js";
import { KNEX_CENTRAL_SETTING, KNEX_TENANT_SETTING } from "./config.js";

export async function validateKnexPolicies<TTenant extends TenantRecord>(
  config: KnexTenancyConfig<TTenant>,
): Promise<TenancyAdapterValidationResult> {
  return validatePostgresRlsPolicies({
    codePrefix: "TENANCY_KNEX",
    adapterName: "Knex",
    execute: ((sql, bindings) =>
      bindings === undefined
        ? config.knex.raw(sql)
        : config.knex.raw(sql, [...bindings])) satisfies PostgresExecutor,
    tables: Object.values(config.tenantTables).map((table) => ({
      ...table,
      schema: table.schema!,
    })),
    tenantSetting: KNEX_TENANT_SETTING,
    centralSetting: KNEX_CENTRAL_SETTING,
  });
}
