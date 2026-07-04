import type { AdonisTenancyResolutionFailure } from "./types.js";

export type AdonisTenancyErrorCode =
  "E_TENANCY_ADONIS_CONFIGURATION" | "E_TENANCY_ADONIS_RESOLUTION";

/**
 * Base error for the AdonisJS integration. Plain `Error` subclasses keep the
 * compiled package free of any runtime AdonisJS import; the `status` field
 * follows the AdonisJS exception convention so the default handler renders a
 * safe HTTP status without leaking internal detail.
 */
export class AdonisTenancyError extends Error {
  readonly code: AdonisTenancyErrorCode;

  constructor(message: string, code: AdonisTenancyErrorCode) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class AdonisTenancyConfigurationError extends AdonisTenancyError {
  constructor(message: string) {
    super(message, "E_TENANCY_ADONIS_CONFIGURATION");
  }
}

export class AdonisTenancyResolutionError extends AdonisTenancyError {
  readonly reason: AdonisTenancyResolutionFailure;
  readonly status: 400 | 404 | 500;

  constructor(reason: AdonisTenancyResolutionFailure) {
    const { message, status } = resolutionErrorDetails(reason);
    super(message, "E_TENANCY_ADONIS_RESOLUTION");
    this.reason = reason;
    this.status = status;
  }
}

function resolutionErrorDetails(reason: AdonisTenancyResolutionFailure): {
  readonly message: string;
  readonly status: 400 | 404 | 500;
} {
  switch (reason) {
    case "no-identifier":
      return { message: "Tenant identity is required.", status: 400 };
    case "invalid":
      return { message: "Tenant identity is invalid.", status: 400 };
    case "not-found":
    case "suspended":
      return { message: "Tenant was not found.", status: 404 };
    case "ambiguous":
      return { message: "Tenant resolution is unavailable.", status: 500 };
  }
}
