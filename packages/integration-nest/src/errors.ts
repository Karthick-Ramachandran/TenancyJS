import { HttpException } from "@nestjs/common";
import { describeTenantResolutionFailure } from "tenancyjs-identifiers";

import type { NestTenancyResolutionFailure } from "./types.js";

export class NestTenancyConfigurationError extends Error {
  readonly code = "E_TENANCY_NEST_CONFIGURATION";

  constructor(message: string) {
    super(message);
    this.name = "NestTenancyConfigurationError";
  }
}

export class NestTenancyResolutionError extends HttpException {
  readonly code = "E_TENANCY_NEST_RESOLUTION";
  readonly reason: NestTenancyResolutionFailure;

  constructor(reason: NestTenancyResolutionFailure) {
    const { message, status } = describeTenantResolutionFailure(reason);
    super(
      Object.freeze({
        statusCode: status,
        error: "Tenant Resolution Failed",
        message,
        code: "E_TENANCY_NEST_RESOLUTION",
      }),
      status,
    );
    this.name = "NestTenancyResolutionError";
    this.reason = reason;
  }
}
