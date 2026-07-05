import type { CanActivate, ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { TenantRecord } from "tenancyjs-core";

import { NestTenancyResolutionError } from "./errors.js";
import { createNestResolverInput } from "./request.js";
import type { NestTenantResolutionStore } from "./resolution-store.js";
import { TENANT_ROUTE_METADATA } from "./route.js";
import type { NestTenantResolver } from "./types.js";

export class NestTenantResolutionGuard<
  TTenant extends TenantRecord = TenantRecord,
> implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly resolver: NestTenantResolver<TTenant>,
    private readonly store: NestTenantResolutionStore<TTenant>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!isTenantRoute(this.reflector, context)) return true;
    const request = context.switchToHttp().getRequest<unknown>();
    const outcome = await this.resolver.resolve(
      createNestResolverInput(request),
    );
    if (outcome.status !== "resolved") {
      throw new NestTenancyResolutionError(outcome.status);
    }
    this.store.set(request as object, outcome.tenant);
    return true;
  }
}

export function isTenantRoute(
  reflector: Reflector,
  context: Pick<ExecutionContext, "getClass" | "getHandler">,
): boolean {
  return (
    reflector.getAllAndOverride<boolean>(TENANT_ROUTE_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]) === true
  );
}
