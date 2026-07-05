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
