import type {
  MaybePromise,
  TenancyAdapterValidationResult,
  TenancyManager,
  TenantRecord,
} from "@tenancyjs/core";
import type {
  ResolverInput,
  TenantResolutionOutcome,
} from "@tenancyjs/identifiers";
import type { HttpContext } from "@adonisjs/core/http";

import type { AdonisTenancyResolutionError } from "./errors.js";

/**
 * Framework-neutral resolver contract the integration accepts. The application
 * owns the resolver; the integration never creates one.
 */
export interface AdonisTenantResolver<
  TTenant extends TenantRecord = TenantRecord,
> {
  resolve(input: ResolverInput): MaybePromise<TenantResolutionOutcome<TTenant>>;
}

/**
 * The application-owned Lucid tenancy service the middleware runs tenant work
 * through. `@tenancyjs/adapter-lucid`'s `LucidTenancyAdapter` satisfies this
 * structurally; the integration creates no hidden database client of its own.
 */
export interface AdonisTenancyRunner {
  validate(): MaybePromise<TenancyAdapterValidationResult>;
  run<TResult>(callback: () => MaybePromise<TResult>): Promise<TResult>;
}

export type AdonisTenancyResolutionFailure =
  "no-identifier" | "invalid" | "not-found" | "suspended" | "ambiguous";

export type AdonisTenancyErrorHandler = (
  error: AdonisTenancyResolutionError,
  ctx: HttpContext,
) => MaybePromise<void>;

export interface AdonisTenancyOptions<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly manager: TenancyManager<TTenant>;
  readonly resolver: AdonisTenantResolver<TTenant>;
  readonly tenancy: AdonisTenancyRunner;
  readonly onError?: AdonisTenancyErrorHandler;
}

export interface AdonisTenancyConfig<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly manager: TenancyManager<TTenant>;
  readonly resolver: AdonisTenantResolver<TTenant>;
  readonly tenancy: AdonisTenancyRunner;
  readonly onError: AdonisTenancyErrorHandler;
}
