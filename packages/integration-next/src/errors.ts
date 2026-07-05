import { describeTenantResolutionFailure } from "tenancyjs-identifiers";

import type { NextTenancyResolutionFailure } from "./types.js";

export type NextTenancyErrorCode =
  "TENANCY_NEXT_CONFIGURATION" | "TENANCY_NEXT_RESOLUTION";

export class NextTenancyError extends Error {
  readonly code: NextTenancyErrorCode;

  constructor(message: string, code: NextTenancyErrorCode) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class NextTenancyConfigurationError extends NextTenancyError {
  constructor(message: string) {
    super(message, "TENANCY_NEXT_CONFIGURATION");
  }
}

export class NextTenancyResolutionError extends NextTenancyError {
  readonly reason: NextTenancyResolutionFailure;
  readonly statusCode: 400 | 404 | 500;

  constructor(reason: NextTenancyResolutionFailure) {
    const { message, status } = describeTenantResolutionFailure(reason);
    super(message, "TENANCY_NEXT_RESOLUTION");
    this.reason = reason;
    this.statusCode = status;
  }
}
