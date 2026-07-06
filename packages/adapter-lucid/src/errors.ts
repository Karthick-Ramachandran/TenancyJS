import { AdapterTenancyError } from "tenancyjs-adapter-shared";

export type LucidTenancyErrorCode =
  | "TENANCY_LUCID_CONFIGURATION"
  | "TENANCY_LUCID_POLICY_VALIDATION"
  | "TENANCY_LUCID_SCOPE"
  | "TENANCY_LUCID_TENANT_FIELD_CONFLICT";

export class LucidTenancyError extends AdapterTenancyError<LucidTenancyErrorCode> {}

export class LucidTenancyConfigurationError extends LucidTenancyError {
  constructor(message: string) {
    super(message, "TENANCY_LUCID_CONFIGURATION");
  }
}

export class LucidPolicyValidationError extends LucidTenancyError {
  constructor() {
    super(
      "Call and check `await tenancy.validate()` at startup — the adapter refuses to run queries until the isolation contract (RLS policy / schema / config) is verified. Docs: https://tenancyjs.pages.dev/docs/concepts/security",
      "TENANCY_LUCID_POLICY_VALIDATION",
    );
  }
}

export class LucidScopeError extends LucidTenancyError {
  readonly model: string;
  readonly operation: string;

  constructor(model: string, operation: string) {
    super(
      `${model}.${operation} ran outside a tenant scope. TenancyJS refused it instead of returning ` +
        `unscoped data (fail-closed). Query tenant-aware models inside tenancy.run(…), or make sure the ` +
        `request went through the AdonisJS tenancy middleware. ` +
        `Docs: https://tenancyjs.pages.dev/docs/concepts/tenant-context`,
      "TENANCY_LUCID_SCOPE",
    );
    this.model = model;
    this.operation = operation;
  }
}

export class LucidTenantFieldConflictError extends LucidTenancyError {
  readonly model: string;
  readonly operation: string;

  constructor(model: string, operation: string) {
    super(
      `${model}.${operation} set a tenant id that doesn't match the current tenant. Omit it (TenancyJS injects it for you) or use the active tenant's id — rows can't move between tenants.`,
      "TENANCY_LUCID_TENANT_FIELD_CONFLICT",
    );
    this.model = model;
    this.operation = operation;
  }
}
