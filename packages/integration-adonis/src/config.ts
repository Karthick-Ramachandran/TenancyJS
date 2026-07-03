import type { TenantRecord } from "@tenancyjs/core";

import { AdonisTenancyConfigurationError } from "./errors.js";
import type {
  AdonisTenancyConfig,
  AdonisTenancyErrorHandler,
  AdonisTenancyOptions,
} from "./types.js";

/**
 * Container/config key under which the application registers its tenancy config
 * (`config/tenancy.ts`). The provider reads the frozen config from here.
 */
export const TENANCY_CONFIG_KEY = "tenancy";

/**
 * Validate and freeze one application-owned tenancy configuration. It never
 * creates a manager, resolver, database client, or central-mode path; every
 * collaborator is supplied by the application.
 */
export function defineAdonisTenancyConfig<
  TTenant extends TenantRecord = TenantRecord,
>(options: AdonisTenancyOptions<TTenant>): AdonisTenancyConfig<TTenant> {
  if (options === null || typeof options !== "object") {
    throw new AdonisTenancyConfigurationError(
      "AdonisJS tenancy configuration is required.",
    );
  }
  if (
    options.manager === null ||
    typeof options.manager !== "object" ||
    typeof options.manager.runWithTenant !== "function"
  ) {
    throw new AdonisTenancyConfigurationError(
      "AdonisJS tenancy configuration requires a TenancyManager.",
    );
  }
  if (
    options.resolver === null ||
    typeof options.resolver !== "object" ||
    typeof options.resolver.resolve !== "function"
  ) {
    throw new AdonisTenancyConfigurationError(
      "AdonisJS tenancy configuration requires a tenant resolver.",
    );
  }
  if (
    options.tenancy === null ||
    typeof options.tenancy !== "object" ||
    typeof options.tenancy.run !== "function" ||
    typeof options.tenancy.validate !== "function"
  ) {
    throw new AdonisTenancyConfigurationError(
      "AdonisJS tenancy configuration requires a Lucid tenancy service.",
    );
  }
  if (options.onError !== undefined && typeof options.onError !== "function") {
    throw new AdonisTenancyConfigurationError(
      "AdonisJS tenancy onError must be a function.",
    );
  }

  return Object.freeze({
    manager: options.manager,
    resolver: options.resolver,
    tenancy: options.tenancy,
    onError: options.onError ?? defaultErrorHandler,
  });
}

const defaultErrorHandler: AdonisTenancyErrorHandler = (error) => {
  throw error;
};
