import type { ApplicationService } from "@adonisjs/core/types";

import { TENANCY_CONFIG_KEY } from "./config.js";
import { AdonisTenancyConfigurationError } from "./errors.js";
import { TenancyMiddleware } from "./middleware.js";
import type { AdonisTenancyConfig } from "./types.js";

/**
 * AdonisJS 7 service provider. It registers the tenant middleware binding during
 * `register`, validates the Lucid isolation policy during `ready` (failing
 * closed before any request is served), and releases integration-owned
 * resources during `shutdown`. The application owns the manager, resolver, and
 * Lucid database service; the provider creates none of them.
 */
export default class TenancyProvider {
  constructor(protected app: ApplicationService) {}

  register(): void {
    const config = this.#config();
    this.app.container.singleton(
      TenancyMiddleware,
      () => new TenancyMiddleware(config),
    );
  }

  async ready(): Promise<void> {
    const result = await this.#config().tenancy.validate();
    if (!result.valid) {
      throw new AdonisTenancyConfigurationError(
        "AdonisJS tenancy could not validate the Lucid isolation policy.",
      );
    }
  }

  async shutdown(): Promise<void> {
    // The integration owns no long-lived resources; the application owns the
    // Lucid database service and is responsible for closing it.
  }

  #config(): AdonisTenancyConfig {
    return this.app.config.get(TENANCY_CONFIG_KEY) as AdonisTenancyConfig;
  }
}
