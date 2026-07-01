export type TenancyErrorCode =
  | "TENANCY_CONTEXT_UNAVAILABLE"
  | "TENANCY_INVALID_TENANT"
  | "TENANCY_INVALID_BOOTSTRAPPER"
  | "TENANCY_DUPLICATE_BOOTSTRAPPER"
  | "TENANCY_LIFECYCLE_FAILED";

export class TenancyError extends Error {
  readonly code: TenancyErrorCode;

  constructor(message: string, code: TenancyErrorCode, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

export type TenantContextErrorReason = "missing" | "central";

export class TenantContextError extends TenancyError {
  readonly reason: TenantContextErrorReason;

  constructor(reason: TenantContextErrorReason) {
    const message =
      reason === "missing"
        ? "Tenant context is required but no tenancy scope is active."
        : "Tenant context is unavailable inside an explicit central scope.";

    super(message, "TENANCY_CONTEXT_UNAVAILABLE");
    this.reason = reason;
  }
}

export class InvalidTenantError extends TenancyError {
  constructor(
    message = "Tenant must be an object with a non-empty string id.",
  ) {
    super(message, "TENANCY_INVALID_TENANT");
  }
}

export class InvalidBootstrapperError extends TenancyError {
  constructor(message = "Bootstrapper id must be a non-empty string.") {
    super(message, "TENANCY_INVALID_BOOTSTRAPPER");
  }
}

export class DuplicateBootstrapperError extends TenancyError {
  readonly bootstrapperId: string;

  constructor(bootstrapperId: string) {
    super(
      `Bootstrapper id "${bootstrapperId}" is registered more than once.`,
      "TENANCY_DUPLICATE_BOOTSTRAPPER",
    );
    this.bootstrapperId = bootstrapperId;
  }
}

export class TenancyLifecycleError extends TenancyError {
  readonly hasPrimaryError: boolean;
  readonly primaryError: unknown | undefined;
  readonly cleanupErrors: readonly unknown[];

  constructor(
    primaryError: unknown | undefined,
    cleanupErrors: readonly unknown[],
    hasPrimaryError = primaryError !== undefined,
  ) {
    const count = cleanupErrors.length;
    const message = hasPrimaryError
      ? `Tenancy execution failed and ${count} lifecycle cleanup error${count === 1 ? "" : "s"} occurred.`
      : `${count} tenancy lifecycle cleanup error${count === 1 ? "" : "s"} occurred.`;

    super(message, "TENANCY_LIFECYCLE_FAILED", {
      cause: hasPrimaryError ? primaryError : cleanupErrors[0],
    });
    this.hasPrimaryError = hasPrimaryError;
    this.primaryError = primaryError;
    this.cleanupErrors = Object.freeze([...cleanupErrors]);
  }
}
