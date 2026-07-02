import type { ExpressTenancyResolutionFailure } from "./types.js";

export type ExpressTenancyErrorCode =
  "TENANCY_EXPRESS_CONFIGURATION" | "TENANCY_EXPRESS_RESOLUTION";

export class ExpressTenancyError extends Error {
  readonly code: ExpressTenancyErrorCode;

  constructor(message: string, code: ExpressTenancyErrorCode) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class ExpressTenancyConfigurationError extends ExpressTenancyError {
  constructor(message: string) {
    super(message, "TENANCY_EXPRESS_CONFIGURATION");
  }
}

export class ExpressTenancyResolutionError extends ExpressTenancyError {
  readonly reason: ExpressTenancyResolutionFailure;
  readonly statusCode: 400 | 404 | 500;

  constructor(reason: ExpressTenancyResolutionFailure) {
    const { message, statusCode } = resolutionErrorDetails(reason);
    super(message, "TENANCY_EXPRESS_RESOLUTION");
    this.reason = reason;
    this.statusCode = statusCode;
  }
}

function resolutionErrorDetails(reason: ExpressTenancyResolutionFailure): {
  readonly message: string;
  readonly statusCode: 400 | 404 | 500;
} {
  switch (reason) {
    case "no-identifier":
      return { message: "Tenant identity is required.", statusCode: 400 };
    case "invalid":
      return { message: "Tenant identity is invalid.", statusCode: 400 };
    case "not-found":
    case "suspended":
      return { message: "Tenant was not found.", statusCode: 404 };
    case "ambiguous":
      return { message: "Tenant resolution is unavailable.", statusCode: 500 };
  }
}
