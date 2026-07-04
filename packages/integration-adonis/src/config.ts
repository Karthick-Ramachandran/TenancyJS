import type { TenantRecord } from "@tenancyjs/core";

import { AdonisTenancyConfigurationError } from "./errors.js";
import type {
  AdonisTenancyConfig,
  AdonisTenancyErrorHandler,
  AdonisTenancyOptions,
  AdonisTenancyRunner,
} from "./types.js";

function isRunner(value: unknown): value is AdonisTenancyRunner {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as AdonisTenancyRunner).run === "function" &&
    typeof (value as AdonisTenancyRunner).validate === "function"
  );
}

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
  if (typeof options.tenancy !== "function" && !isRunner(options.tenancy)) {
    throw new AdonisTenancyConfigurationError(
      "AdonisJS tenancy configuration requires a Lucid tenancy service or a factory that returns one.",
    );
  }
  if (options.onError !== undefined && typeof options.onError !== "function") {
    throw new AdonisTenancyConfigurationError(
      "AdonisJS tenancy onError must be a function.",
    );
  }

  // The Lucid tenancy service may be supplied lazily as a factory. AdonisJS loads
  // config before providers boot, so the Lucid database service is not live at
  // config time; the factory is resolved once, on first use (the provider does
  // this during `ready()`, after the Lucid provider has booted).
  const tenancyInput = options.tenancy;
  let resolvedTenancy: AdonisTenancyRunner | undefined;
  const resolveTenancy = (): AdonisTenancyRunner => {
    if (resolvedTenancy === undefined) {
      const candidate =
        typeof tenancyInput === "function" ? tenancyInput() : tenancyInput;
      if (!isRunner(candidate)) {
        throw new AdonisTenancyConfigurationError(
          "The AdonisJS tenancy factory must return a Lucid tenancy service.",
        );
      }
      resolvedTenancy = candidate;
    }
    return resolvedTenancy;
  };

  return Object.freeze({
    manager: options.manager,
    resolver: options.resolver,
    onError: options.onError ?? defaultErrorHandler,
    get tenancy(): AdonisTenancyRunner {
      return resolveTenancy();
    },
  });
}

const defaultErrorHandler: AdonisTenancyErrorHandler = (error) => {
  throw error;
};
