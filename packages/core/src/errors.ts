export type TenancyErrorCode =
  | "TENANCY_CONTEXT_UNAVAILABLE"
  | "TENANCY_INVALID_TENANT"
  | "TENANCY_INVALID_BOOTSTRAPPER"
  | "TENANCY_DUPLICATE_BOOTSTRAPPER"
  | "TENANCY_LIFECYCLE_FAILED"
  | "TENANCY_STORE_METHOD_UNSUPPORTED"
  | "TENANCY_STORE_INVALID_TENANT"
  | "TENANCY_STORE_ID_MISMATCH"
  | "TENANCY_STORE_DUPLICATE_ID"
  | "TENANCY_RUNTIME_INVALID";

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
        ? "No active tenant scope. TenancyJS refused this tenant-aware access instead of " +
          "returning another tenant's data (this is fail-closed, by design). Run it inside a tenant " +
          "scope — e.g. manager.runWithTenant(tenant, …) or your framework's tenancy middleware. " +
          "Docs: https://tenancyjs.pages.dev/docs/concepts/tenant-context"
        : "You're in the central (cross-tenant) scope, so there is no current tenant. Open a tenant " +
          "scope if you meant to act as one; use getContext() to read the central marker here. " +
          "Docs: https://tenancyjs.pages.dev/docs/concepts/tenant-context#central-context";

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

/**
 * Raised when a host-provided {@link TenantStore} violates its contract — the
 * boundary that keeps bring-your-own stores from silently handing back the
 * wrong tenant (ADR-0028). Every failure here is fail-closed: the CLI refuses
 * to act on the returned data.
 */
export class TenantStoreContractError extends TenancyError {
  readonly method: string;

  constructor(
    message: string,
    code: Extract<
      TenancyErrorCode,
      | "TENANCY_STORE_METHOD_UNSUPPORTED"
      | "TENANCY_STORE_INVALID_TENANT"
      | "TENANCY_STORE_ID_MISMATCH"
      | "TENANCY_STORE_DUPLICATE_ID"
    >,
    method: string,
  ) {
    super(message, code);
    this.method = method;
  }
}

/** Raised when a loaded tenancy runtime does not satisfy the runtime contract. */
export class InvalidTenancyRuntimeError extends TenancyError {
  constructor(message: string) {
    super(message, "TENANCY_RUNTIME_INVALID");
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
