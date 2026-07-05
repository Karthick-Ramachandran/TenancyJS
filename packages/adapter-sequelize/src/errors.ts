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
      "Sequelize tenancy validation must pass before protected execution.",
      "TENANCY_SEQUELIZE_POLICY_VALIDATION",
    );
  }
}
export class SequelizeModelUnregisteredError extends SequelizeTenancyError {
  constructor() {
    super(
      "Sequelize model was rejected because it is not classified.",
      "TENANCY_SEQUELIZE_MODEL_UNREGISTERED",
    );
  }
}
export class SequelizeTenantFieldConflictError extends SequelizeTenancyError {
  constructor(operation: string) {
    super(
      `Sequelize ${operation} was rejected because its tenant discriminator conflicts with the active context.`,
      "TENANCY_SEQUELIZE_TENANT_FIELD_CONFLICT",
    );
  }
}
export class SequelizeUnsafeCriteriaError extends SequelizeTenancyError {
  constructor() {
    super(
      "Sequelize criteria were rejected because the initial protected boundary accepts plain scalar equality only.",
      "TENANCY_SEQUELIZE_CRITERIA_UNSAFE",
    );
  }
}
