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
      "Lucid tenancy isolation validation must pass before protected execution. Run and review adapter.validate() during application startup.",
      "TENANCY_LUCID_POLICY_VALIDATION",
    );
  }
}

export class LucidScopeError extends LucidTenancyError {
  readonly model: string;
  readonly operation: string;

  constructor(model: string, operation: string) {
    super(
      `Lucid ${model}.${operation} requires an active createLucidTenancy run callback.`,
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
      `Lucid ${model}.${operation} was rejected because its tenant discriminator conflicts with the active context. Remove the supplied field or use the active tenant id; updates cannot move rows between tenants.`,
      "TENANCY_LUCID_TENANT_FIELD_CONFLICT",
    );
    this.model = model;
    this.operation = operation;
  }
}
