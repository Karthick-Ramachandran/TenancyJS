import { describeTenantResolutionFailure } from "tenancyjs-identifiers";

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
    const { message, status } = describeTenantResolutionFailure(reason);
    super(message, "TENANCY_EXPRESS_RESOLUTION");
    this.reason = reason;
    this.statusCode = status;
  }
}
