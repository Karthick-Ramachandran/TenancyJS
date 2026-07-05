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
      "TypeORM tenancy validation must pass before protected execution.",
      "TENANCY_TYPEORM_POLICY_VALIDATION",
    );
  }
}

export class TypeOrmEntityUnregisteredError extends TypeOrmTenancyError {
  constructor() {
    super(
      "TypeORM entity was rejected because it is not classified.",
      "TENANCY_TYPEORM_ENTITY_UNREGISTERED",
    );
  }
}

export class TypeOrmTenantFieldConflictError extends TypeOrmTenancyError {
  constructor(operation: string) {
    super(
      `TypeORM ${operation} was rejected because its tenant discriminator conflicts with the active context.`,
      "TENANCY_TYPEORM_TENANT_FIELD_CONFLICT",
    );
  }
}

export class TypeOrmUnsafeCriteriaError extends TypeOrmTenancyError {
  constructor() {
    super(
      "TypeORM criteria were rejected because the initial protected boundary accepts plain scalar equality only.",
      "TENANCY_TYPEORM_CRITERIA_UNSAFE",
    );
  }
}
