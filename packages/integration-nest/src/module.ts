import { Module, type DynamicModule, type Provider } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR, Reflector } from "@nestjs/core";
import type { TenantRecord } from "tenancyjs-core";

import { NestTenancyConfigurationError } from "./errors.js";
import { NestTenantResolutionGuard } from "./guard.js";
import { NestTenantContextInterceptor } from "./interceptor.js";
import { NestTenantResolutionStore } from "./resolution-store.js";
import type { NestTenancyOptions } from "./types.js";

const NEST_TENANCY_OPTIONS = Symbol("NEST_TENANCY_OPTIONS");

@Module({})
export class TenancyModule {
  static forRoot<TTenant extends TenantRecord = TenantRecord>(
    options: NestTenancyOptions<TTenant>,
  ): DynamicModule {
    const validated = validateOptions(options);
    const providers: Provider[] = [
      { provide: NEST_TENANCY_OPTIONS, useValue: validated },
      NestTenantResolutionStore,
      {
        provide: APP_GUARD,
        inject: [Reflector, NEST_TENANCY_OPTIONS, NestTenantResolutionStore],
        useFactory: (
          reflector: Reflector,
          config: NestTenancyOptions<TTenant>,
          store: NestTenantResolutionStore<TTenant>,
        ) =>
          new NestTenantResolutionGuard(
            reflector,
            config.resolver,
            store,
            config.principal,
          ),
      },
      {
        provide: APP_INTERCEPTOR,
        inject: [Reflector, NEST_TENANCY_OPTIONS, NestTenantResolutionStore],
        useFactory: (
          reflector: Reflector,
          config: NestTenancyOptions<TTenant>,
          store: NestTenantResolutionStore<TTenant>,
        ) =>
          new NestTenantContextInterceptor(
            reflector,
            config.manager,
            store,
            config.executor,
          ),
      },
    ];
    return {
      module: TenancyModule,
      global: true,
      providers,
      exports: [NestTenantResolutionStore],
    };
  }
}

function validateOptions<TTenant extends TenantRecord>(
  options: NestTenancyOptions<TTenant>,
): Readonly<NestTenancyOptions<TTenant>> {
  if (options === null || typeof options !== "object") {
    throw new NestTenancyConfigurationError(
      "Nest tenancy options are required.",
    );
  }
  if (typeof options.manager?.runWithTenant !== "function") {
    throw new NestTenancyConfigurationError(
      "Nest tenancy requires a TenancyManager.",
    );
  }
  if (typeof options.resolver?.resolve !== "function") {
    throw new NestTenancyConfigurationError(
      "Nest tenancy requires a tenant resolver.",
    );
  }
  if (
    options.executor !== undefined &&
    typeof options.executor.run !== "function"
  ) {
    throw new NestTenancyConfigurationError(
      "Nest tenancy executor must expose run(callback).",
    );
  }
  if (
    options.principal !== undefined &&
    typeof options.principal !== "function"
  ) {
    throw new NestTenancyConfigurationError(
      "Nest tenancy principal must be a function.",
    );
  }
  return Object.freeze({
    manager: options.manager,
    resolver: options.resolver,
    ...(options.executor === undefined ? {} : { executor: options.executor }),
    ...(options.principal === undefined
      ? {}
      : { principal: options.principal }),
  });
}
