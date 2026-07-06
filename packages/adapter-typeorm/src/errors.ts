import { AdapterTenancyError } from "tenancyjs-adapter-shared";

export type TypeOrmTenancyErrorCode =
  | "TENANCY_TYPEORM_CONFIGURATION"
  | "TENANCY_TYPEORM_POLICY_VALIDATION"
  | "TENANCY_TYPEORM_ENTITY_UNREGISTERED"
  | "TENANCY_TYPEORM_TENANT_FIELD_CONFLICT"
  | "TENANCY_TYPEORM_CRITERIA_UNSAFE";

export class TypeOrmTenancyError extends AdapterTenancyError<TypeOrmTenancyErrorCode> {}

export class TypeOrmTenancyConfigurationError extends TypeOrmTenancyError {
  constructor(message: string) {
    super(message, "TENANCY_TYPEORM_CONFIGURATION");
  }
}

export class TypeOrmPolicyValidationError extends TypeOrmTenancyError {
  constructor() {
    super(
      "Call and check `await tenancy.validate()` at startup — the adapter refuses to run queries until the isolation contract (RLS policy / schema / config) is verified. Docs: https://tenancyjs.pages.dev/docs/concepts/security",
      "TENANCY_TYPEORM_POLICY_VALIDATION",
    );
  }
}

export class TypeOrmEntityUnregisteredError extends TypeOrmTenancyError {
  constructor() {
    super(
      "This entity isn't registered as a tenant entity. Add it to `tenantEntities` (or `centralEntities` if it's shared across tenants) before querying through the scoped client.",
      "TENANCY_TYPEORM_ENTITY_UNREGISTERED",
    );
  }
}

export class TypeOrmTenantFieldConflictError extends TypeOrmTenancyError {
  constructor(operation: string) {
    super(
      `${operation} set a tenant id that doesn't match the current tenant. Omit it (TenancyJS injects it for you) or use the active tenant's id — rows can't move between tenants.`,
      "TENANCY_TYPEORM_TENANT_FIELD_CONFLICT",
    );
  }
}

export class TypeOrmUnsafeCriteriaError extends TypeOrmTenancyError {
  constructor() {
    super(
      "Only plain scalar filters (string, number, boolean, date, id) are allowed. Operators, nested objects, and complex criteria are rejected because they can't be verified tenant-safe. Docs: https://tenancyjs.pages.dev/docs/concepts/limitations",
      "TENANCY_TYPEORM_CRITERIA_UNSAFE",
    );
  }
}
