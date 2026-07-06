import { AdapterTenancyError } from "tenancyjs-adapter-shared";

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
      `Model "${model}" isn't registered as a tenant model. Add it to \`tenantModels\` (or \`centralModels\` if it's shared across tenants) before querying through the scoped client.`,
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
      `${model}.${operation} set a tenant id that doesn't match the current tenant. Omit it (TenancyJS injects it for you) or use the active tenant's id — records can't move between tenants.`,
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
        ? `Operation "${operation}" isn't a supported scoped operation. Raw SQL and native handles are rejected fail-closed because they can't be proven tenant-safe — use a supported Prisma Client model operation, or a database-per-tenant scope. Docs: https://tenancyjs.pages.dev/docs/concepts/limitations`
        : reason === "relation"
          ? `${model}.${operation} isn't scoped: nested and relational writes aren't intercepted by the Prisma extension, so they're rejected fail-closed. Split it into separate scoped operations (wrap them in a transaction if you need atomicity), or use database-per-tenant. Docs: https://tenancyjs.pages.dev/docs/concepts/limitations`
          : `${model}.${operation} isn't a supported scoped operation. Complex or nested operations are rejected fail-closed because they can't be proven tenant-safe — use a supported top-level Prisma Client operation. Docs: https://tenancyjs.pages.dev/docs/concepts/limitations`;
    super(message, "TENANCY_PRISMA_UNSUPPORTED_OPERATION");
    this.model = model;
    this.operation = operation;
    this.reason = reason;
  }
}
