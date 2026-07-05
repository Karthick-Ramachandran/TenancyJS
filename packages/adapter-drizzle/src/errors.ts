import { AdapterTenancyError } from "tenancyjs-adapter-shared";

export class DrizzleTenancyConfigurationError extends AdapterTenancyError {
  constructor(message: string) {
    super("TENANCY_DRIZZLE_CONFIGURATION", message);
  }
}

export class DrizzlePolicyValidationError extends AdapterTenancyError {
  constructor() {
    super(
      "TENANCY_DRIZZLE_POLICY_NOT_VALIDATED",
      "Drizzle tenancy cannot execute before its isolation policy is validated.",
    );
  }
}

export class DrizzleTableUnregisteredError extends AdapterTenancyError {
  constructor() {
    super(
      "TENANCY_DRIZZLE_TABLE_UNREGISTERED",
      "The Drizzle table is not registered in the tenancy policy.",
    );
  }
}

export class DrizzleUnsafeCriteriaError extends AdapterTenancyError {
  constructor() {
    super(
      "TENANCY_DRIZZLE_UNSAFE_CRITERIA",
      "Drizzle criteria were rejected because the protected boundary accepts plain scalar equality only.",
    );
  }
}

export class DrizzleTenantFieldConflictError extends AdapterTenancyError {
  constructor(operation: string) {
    super(
      "TENANCY_DRIZZLE_TENANT_FIELD_CONFLICT",
      `Drizzle ${operation} cannot target a tenant other than the active tenant.`,
    );
  }
}
