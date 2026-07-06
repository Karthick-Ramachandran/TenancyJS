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
      "Call and check `await tenancy.validate()` at startup — the adapter refuses to run queries until the isolation contract (RLS policy / schema / config) is verified. Docs: https://tenancyjs.pages.dev/docs/concepts/security",
    );
  }
}

export class DrizzleTableUnregisteredError extends AdapterTenancyError {
  constructor() {
    super(
      "TENANCY_DRIZZLE_TABLE_UNREGISTERED",
      "This table isn't registered as a tenant table. Add it to `tenantTables` (or `centralTables` if it's shared across tenants) before querying through the scoped client.",
    );
  }
}

export class DrizzleUnsafeCriteriaError extends AdapterTenancyError {
  constructor() {
    super(
      "TENANCY_DRIZZLE_UNSAFE_CRITERIA",
      "Only plain scalar filters (string, number, boolean, date, id) are allowed. Operators, nested objects, and complex criteria are rejected because they can't be verified tenant-safe. Docs: https://tenancyjs.pages.dev/docs/concepts/limitations",
    );
  }
}

export class DrizzleTenantFieldConflictError extends AdapterTenancyError {
  constructor(operation: string) {
    super(
      "TENANCY_DRIZZLE_TENANT_FIELD_CONFLICT",
      `${operation} set a tenant id that doesn't match the current tenant. Omit it (TenancyJS injects it for you) or use the active tenant's id — rows can't move between tenants.`,
    );
  }
}
