import type {
  MaybePromise,
  TenancyManager,
  TenantRecord,
} from "tenancyjs-core";
import type {
  ResolverInput,
  TenantResolutionOutcome,
} from "tenancyjs-identifiers";
import type { NextFunction, Request, Response } from "express";

import type { ExpressTenancyResolutionError } from "./errors.js";

export interface ExpressTenantResolver<
  TTenant extends TenantRecord = TenantRecord,
> {
  resolve(input: ResolverInput): MaybePromise<TenantResolutionOutcome<TTenant>>;
}

export type ExpressTenancyResolutionFailure =
  "no-identifier" | "invalid" | "not-found" | "suspended" | "ambiguous";

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
}
