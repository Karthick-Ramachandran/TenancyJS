import { AdapterTenancyError } from "tenancyjs-adapter-shared";

export type MongooseTenancyErrorCode =
  | "TENANCY_MONGOOSE_CONFIGURATION"
  | "TENANCY_MONGOOSE_VALIDATION"
  | "TENANCY_MONGOOSE_MODEL_UNREGISTERED"
  | "TENANCY_MONGOOSE_TENANT_FIELD_CONFLICT"
  | "TENANCY_MONGOOSE_FILTER_UNSAFE";

export class MongooseTenancyError extends AdapterTenancyError<MongooseTenancyErrorCode> {}
export class MongooseTenancyConfigurationError extends MongooseTenancyError {
  constructor(message: string) {
    super(message, "TENANCY_MONGOOSE_CONFIGURATION");
  }
}
export class MongooseValidationError extends MongooseTenancyError {
  constructor() {
    super(
      "Call and check `await tenancy.validate()` at startup — the adapter refuses to run queries until the isolation contract (config) is verified. Docs: https://tenancyjs.pages.dev/docs/concepts/security",
      "TENANCY_MONGOOSE_VALIDATION",
    );
  }
}
export class MongooseModelUnregisteredError extends MongooseTenancyError {
  constructor() {
    super(
      "This model isn't registered as a tenant model. Add it to `tenantModels` (or `centralModels` if it's shared across tenants) before querying through the scoped client.",
      "TENANCY_MONGOOSE_MODEL_UNREGISTERED",
    );
  }
}
export class MongooseTenantFieldConflictError extends MongooseTenancyError {
  constructor(operation: string) {
    super(
      `${operation} set a tenant id that doesn't match the current tenant. Omit it (TenancyJS injects it for you) or use the active tenant's id — documents can't move between tenants.`,
      "TENANCY_MONGOOSE_TENANT_FIELD_CONFLICT",
    );
  }
}
export class MongooseUnsafeFilterError extends MongooseTenancyError {
  constructor() {
    super(
      "Only plain scalar filters (string, number, boolean, date, id) are allowed. Query operators, nested objects, and complex criteria are rejected because they can't be verified tenant-safe. Docs: https://tenancyjs.pages.dev/docs/concepts/limitations",
      "TENANCY_MONGOOSE_FILTER_UNSAFE",
    );
  }
}
