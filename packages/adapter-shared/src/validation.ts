import type { TenancyAdapterValidationResult } from "tenancyjs-core";

export function deferredDatabaseValidationResult(
  codePrefix: `TENANCY_${string}`,
  adapterName: string,
): TenancyAdapterValidationResult {
  return Object.freeze({
    valid: true,
    issues: Object.freeze([
      Object.freeze({
        code: `${codePrefix}_TENANT_DATABASE_VALIDATION_DEFERRED`,
        severity: "warning" as const,
        message: `${adapterName} database-per-tenant configuration is valid, but tenant database factories and connectivity are verified only when each tenant is first used.`,
      }),
    ]),
  });
}

export function adapterEnforcedRowValidationResult(
  codePrefix: `TENANCY_${string}`,
  adapterName: string,
  databaseName: string,
): TenancyAdapterValidationResult {
  return Object.freeze({
    valid: true,
    issues: Object.freeze([
      Object.freeze({
        code: `${codePrefix}_ROW_ISOLATION_ADAPTER_ENFORCED`,
        severity: "warning" as const,
        message: `${adapterName} row-level isolation on ${databaseName} is adapter-enforced and experimental; the database has no row-level security backstop, so every tenant operation must use the protected facade.`,
      }),
    ]),
  });
}
