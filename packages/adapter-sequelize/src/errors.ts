import { AdapterTenancyError } from "tenancyjs-adapter-shared";

export type SequelizeTenancyErrorCode =
  | "TENANCY_SEQUELIZE_CONFIGURATION"
  | "TENANCY_SEQUELIZE_POLICY_VALIDATION"
  | "TENANCY_SEQUELIZE_MODEL_UNREGISTERED"
  | "TENANCY_SEQUELIZE_TENANT_FIELD_CONFLICT"
  | "TENANCY_SEQUELIZE_CRITERIA_UNSAFE";

export class SequelizeTenancyError extends AdapterTenancyError<SequelizeTenancyErrorCode> {}
export class SequelizeTenancyConfigurationError extends SequelizeTenancyError {
  constructor(message: string) {
    super(message, "TENANCY_SEQUELIZE_CONFIGURATION");
  }
}
export class SequelizePolicyValidationError extends SequelizeTenancyError {
  constructor() {
    super(
      "Call and check `await tenancy.validate()` at startup — the adapter refuses to run queries until the isolation contract (RLS policy / schema / config) is verified. Docs: https://tenancyjs.pages.dev/docs/concepts/security",
      "TENANCY_SEQUELIZE_POLICY_VALIDATION",
    );
  }
}
export class SequelizeModelUnregisteredError extends SequelizeTenancyError {
  constructor() {
    super(
      "This model isn't registered as a tenant model. Add it to `tenantModels` (or `centralModels` if it's shared across tenants) before querying through the scoped client.",
      "TENANCY_SEQUELIZE_MODEL_UNREGISTERED",
    );
  }
}
export class SequelizeTenantFieldConflictError extends SequelizeTenancyError {
  constructor(operation: string) {
    super(
      `${operation} set a tenant id that doesn't match the current tenant. Omit it (TenancyJS injects it for you) or use the active tenant's id — rows can't move between tenants.`,
      "TENANCY_SEQUELIZE_TENANT_FIELD_CONFLICT",
    );
  }
}
export class SequelizeUnsafeCriteriaError extends SequelizeTenancyError {
  constructor() {
    super(
      "Only plain scalar filters (string, number, boolean, date, id) are allowed. Operators, nested objects, and complex criteria are rejected because they can't be verified tenant-safe. Docs: https://tenancyjs.pages.dev/docs/concepts/limitations",
      "TENANCY_SEQUELIZE_CRITERIA_UNSAFE",
    );
  }
}
