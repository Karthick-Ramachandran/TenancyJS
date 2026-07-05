import { AdapterTenancyError } from "@tenancyjs/adapter-shared";

export type PrismaTenancyErrorCode =
  | "TENANCY_PRISMA_CONFIGURATION"
  | "TENANCY_PRISMA_UNREGISTERED_MODEL"
  | "TENANCY_PRISMA_TENANT_FIELD_CONFLICT"
  | "TENANCY_PRISMA_UNSUPPORTED_OPERATION";

export type PrismaUnsupportedOperationReason = "raw" | "relation" | "operation";

export class PrismaTenancyError extends AdapterTenancyError<PrismaTenancyErrorCode> {}

export class PrismaTenancyConfigurationError extends PrismaTenancyError {
  constructor(message: string) {
    super(message, "TENANCY_PRISMA_CONFIGURATION");
  }
}

export class PrismaUnregisteredModelError extends PrismaTenancyError {
  readonly model: string;

  constructor(model: string) {
    super(
      `Prisma model "${model}" was rejected because it is not classified. Add it to tenantModels or centralModels during startup configuration before using the secured client.`,
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
      `Prisma ${model}.${operation} was rejected because its tenant discriminator conflicts with the active context. Remove the supplied field or use the active tenant id; updates cannot move records between tenants.`,
      "TENANCY_PRISMA_TENANT_FIELD_CONFLICT",
    );
    this.model = model;
    this.operation = operation;
  }
}

export class PrismaUnsupportedOperationError extends PrismaTenancyError {
  readonly model: string | undefined;
  readonly operation: string;
  readonly reason: PrismaUnsupportedOperationReason;

  constructor(
    operation: string,
    model?: string,
    reason: PrismaUnsupportedOperationReason = model === undefined
      ? "raw"
      : "operation",
  ) {
    const message =
      reason === "raw"
        ? `Prisma operation "${operation}" was rejected because arbitrary SQL cannot be reliably and generically tenant-scoped. Use a supported Prisma Client model operation, or isolate privileged SQL behind separately reviewed database controls.`
        : reason === "relation"
          ? `Prisma ${model}.${operation} was rejected because nested relation operations are not reliably intercepted by Prisma query extensions. Use supported top-level model operations inside a native transaction.`
          : `Prisma ${model}.${operation} was rejected because it is outside the tested TenancyJS operation matrix. Use a supported top-level Prisma Client operation on the secured client.`;
    super(message, "TENANCY_PRISMA_UNSUPPORTED_OPERATION");
    this.model = model;
    this.operation = operation;
    this.reason = reason;
  }
}
