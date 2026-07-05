import type { TenantRecord } from "@tenancyjs/core";

import { NestTenancyConfigurationError } from "./errors.js";

export class NestTenantResolutionStore<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly #tenants = new WeakMap<object, Readonly<TTenant>>();

  set(request: object, tenant: Readonly<TTenant>): void {
    if (this.#tenants.has(request)) {
      throw new NestTenancyConfigurationError(
        "Nest tenant resolution ran more than once for one request.",
      );
    }
    this.#tenants.set(request, tenant);
  }

  get(request: object): Readonly<TTenant> | undefined {
    return this.#tenants.get(request);
  }

  consume(request: object): Readonly<TTenant> {
    const tenant = this.#tenants.get(request);
    this.#tenants.delete(request);
    if (tenant === undefined) {
      throw new NestTenancyConfigurationError(
        "Nest tenant context interceptor requires prior tenant resolution.",
      );
    }
    return tenant;
  }
}
