export type PrismaTenancyErrorCode =
  | "TENANCY_PRISMA_CONFIGURATION"
  | "TENANCY_PRISMA_UNREGISTERED_MODEL"
  | "TENANCY_PRISMA_TENANT_FIELD_CONFLICT"
  | "TENANCY_PRISMA_UNSUPPORTED_OPERATION";

export class PrismaTenancyError extends Error {
  readonly code: PrismaTenancyErrorCode;

  constructor(
    message: string,
    code: PrismaTenancyErrorCode,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

export class PrismaTenancyConfigurationError extends PrismaTenancyError {
  constructor(message: string) {
    super(message, "TENANCY_PRISMA_CONFIGURATION");
  }
}

export class PrismaUnregisteredModelError extends PrismaTenancyError {
  readonly model: string;

  constructor(model: string) {
    super(
      `Prisma model "${model}" is not classified as tenant-scoped or central.`,
      "TENANCY_PRISMA_UNREGISTERED_MODEL",
    );
    this.model = model;
  }
}

export class PrismaTenantFieldConflictError extends PrismaTenancyError {
  readonly model: string;
  readonly operation: string;

  constructor(model: string, operation: string) {
    super(
      `Prisma ${model}.${operation} conflicts with the active tenant discriminator.`,
      "TENANCY_PRISMA_TENANT_FIELD_CONFLICT",
    );
    this.model = model;
    this.operation = operation;
  }
}

export class PrismaUnsupportedOperationError extends PrismaTenancyError {
  readonly model: string | undefined;
  readonly operation: string;

  constructor(operation: string, model?: string) {
    super(
      model === undefined
        ? `Prisma operation "${operation}" is outside the TenancyJS security boundary.`
        : `Prisma ${model}.${operation} is outside the TenancyJS security boundary.`,
      "TENANCY_PRISMA_UNSUPPORTED_OPERATION",
    );
    this.model = model;
    this.operation = operation;
  }
}
