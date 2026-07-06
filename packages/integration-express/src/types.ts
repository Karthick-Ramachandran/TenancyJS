import type {
  MaybePromise,
  TenancyManager,
  TenantRecord,
} from "tenancyjs-core";
import type {
  ResolverInput,
  TenantResolutionContext,
  TenantResolutionOutcome,
  TenantResolutionFailureStatus,
} from "tenancyjs-identifiers";
import type { NextFunction, Request, Response } from "express";

import type { ExpressTenancyResolutionError } from "./errors.js";

export interface ExpressTenantResolver<
  TTenant extends TenantRecord = TenantRecord,
> {
  resolve(
    input: ResolverInput,
    context?: TenantResolutionContext,
  ): MaybePromise<TenantResolutionOutcome<TTenant>>;
}

export type ExpressTenancyResolutionFailure = TenantResolutionFailureStatus;

export type ExpressTenancyErrorHandler = (
  error: ExpressTenancyResolutionError,
  request: Request,
  response: Response,
  next: NextFunction,
) => MaybePromise<void>;

export interface ExpressTenancyMiddlewareOptions<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly manager: TenancyManager<TTenant>;
  readonly resolver: ExpressTenantResolver<TTenant>;
  readonly onError?: ExpressTenancyErrorHandler;
  /**
   * Extract the authenticated principal from the request (e.g. `(req) => req.user`)
   * so the resolver's `authorize` hook can verify tenant membership. Run this
   * middleware after your authentication so the principal is populated.
   */
  readonly principal?: (request: Request) => unknown;
}
