import { AdapterTenancyError } from "@tenancyjs/adapter-shared";

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
      "Mongoose tenancy validation must pass before protected execution.",
      "TENANCY_MONGOOSE_VALIDATION",
    );
  }
}
export class MongooseModelUnregisteredError extends MongooseTenancyError {
  constructor() {
    super(
      "Mongoose model was rejected because it is not classified.",
      "TENANCY_MONGOOSE_MODEL_UNREGISTERED",
    );
  }
}
export class MongooseTenantFieldConflictError extends MongooseTenancyError {
  constructor(operation: string) {
    super(
      `Mongoose ${operation} was rejected because its tenant discriminator conflicts with the active context.`,
      "TENANCY_MONGOOSE_TENANT_FIELD_CONFLICT",
    );
  }
}
export class MongooseUnsafeFilterError extends MongooseTenancyError {
  constructor() {
    super(
      "Mongoose filter was rejected because the protected boundary accepts plain scalar equality only.",
      "TENANCY_MONGOOSE_FILTER_UNSAFE",
    );
  }
}
