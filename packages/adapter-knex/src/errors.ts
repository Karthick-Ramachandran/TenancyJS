export type KnexTenancyErrorCode =
  | "TENANCY_KNEX_CONFIGURATION"
  | "TENANCY_KNEX_POLICY_VALIDATION"
  | "TENANCY_KNEX_TENANT_FIELD_CONFLICT"
  | "TENANCY_KNEX_UNREGISTERED_TABLE"
  | "TENANCY_KNEX_UNSUPPORTED_OPERATION";

export class KnexTenancyError extends Error {
  readonly code: KnexTenancyErrorCode;

  constructor(
    message: string,
    code: KnexTenancyErrorCode,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

export class KnexTenancyConfigurationError extends KnexTenancyError {
  constructor(message: string) {
    super(message, "TENANCY_KNEX_CONFIGURATION");
  }
}

export class KnexPolicyValidationError extends KnexTenancyError {
  constructor() {
    super(
      "Knex tenancy policy validation must pass before protected execution. Run and review adapter.validate() during application startup.",
      "TENANCY_KNEX_POLICY_VALIDATION",
    );
  }
}

export class KnexUnregisteredTableError extends KnexTenancyError {
  readonly table: string;

  constructor(table: string) {
    super(
      `Knex table "${table}" was rejected because it is not classified. Configure it as tenant-scoped or central before using the protected client.`,
      "TENANCY_KNEX_UNREGISTERED_TABLE",
    );
    this.table = table;
  }
}

export class KnexTenantFieldConflictError extends KnexTenancyError {
  readonly operation: string;
  readonly table: string;

  constructor(table: string, operation: string) {
    super(
      `Knex ${table}.${operation} was rejected because its tenant discriminator conflicts with the active context. Remove the supplied field or use the active tenant id; updates cannot move rows between tenants.`,
      "TENANCY_KNEX_TENANT_FIELD_CONFLICT",
    );
    this.table = table;
    this.operation = operation;
  }
}

export class KnexUnsupportedOperationError extends KnexTenancyError {
  readonly operation: string;
  readonly table: string | undefined;

  constructor(operation: string, table?: string) {
    super(
      table === undefined
        ? `Knex operation "${operation}" was rejected because it is outside the protected client boundary.`
        : `Knex ${table}.${operation} was rejected because it is outside the tested TenancyJS operation matrix.`,
      "TENANCY_KNEX_UNSUPPORTED_OPERATION",
    );
    this.operation = operation;
    this.table = table;
  }
}
