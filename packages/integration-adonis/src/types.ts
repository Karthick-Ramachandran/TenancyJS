import type {
  MaybePromise,
  TenancyAdapterValidationResult,
  TenancyManager,
  TenantRecord,
} from "tenancyjs-core";
import type {
  ResolverInput,
  TenantResolutionContext,
  TenantResolutionOutcome,
} from "tenancyjs-identifiers";
import type { HttpContext } from "@adonisjs/core/http";

import type { AdonisTenancyResolutionError } from "./errors.js";

/**
 * Framework-neutral resolver contract the integration accepts. The application
 * owns the resolver; the integration never creates one.
 */
export interface AdonisTenantResolver<
  TTenant extends TenantRecord = TenantRecord,
> {
  resolve(
    input: ResolverInput,
    context?: TenantResolutionContext,
  ): MaybePromise<TenantResolutionOutcome<TTenant>>;
}

/** Extract the authenticated principal from the request for the membership check. */
export type AdonisPrincipalResolver = (ctx: HttpContext) => unknown;

/**
 * The application-owned Lucid tenancy service the middleware runs tenant work
 * through. `tenancyjs-adapter-lucid`'s `LucidTenancyAdapter` satisfies this
 * structurally; the integration creates no hidden database client of its own.
 */
export interface AdonisTenancyRunner {
  validate(): MaybePromise<TenancyAdapterValidationResult>;
  run<TResult>(callback: () => MaybePromise<TResult>): Promise<TResult>;
}

/**
 * A deferred Lucid tenancy service. AdonisJS loads config files before service
 * providers boot, so the Lucid database service is not live when config is
 * evaluated. Supplying a factory lets the provider build the tenancy service at
 * `ready()`, after the Lucid provider has booted.
 */
export type AdonisTenancyRunnerFactory = () => AdonisTenancyRunner;

export type AdonisTenancyResolutionFailure =
  | "no-identifier"
  | "invalid"
  | "not-found"
  | "suspended"
  | "forbidden"
  | "ambiguous";

export type AdonisTenancyErrorHandler = (
  error: AdonisTenancyResolutionError,
  ctx: HttpContext,
) => MaybePromise<void>;

export interface AdonisTenancyOptions<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly manager: TenancyManager<TTenant>;
  readonly resolver: AdonisTenantResolver<TTenant>;
  readonly tenancy: AdonisTenancyRunner | AdonisTenancyRunnerFactory;
  readonly onError?: AdonisTenancyErrorHandler;
  /**
   * Extract the authenticated principal from the request (e.g. `(ctx) =>
   * ctx.auth.user`) so the resolver's `authorize` hook can verify tenant
   * membership. Apply the middleware after authentication.
   */
  readonly principal?: AdonisPrincipalResolver;
}

export interface AdonisTenancyConfig<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly manager: TenancyManager<TTenant>;
  readonly resolver: AdonisTenantResolver<TTenant>;
  readonly tenancy: AdonisTenancyRunner;
  readonly onError: AdonisTenancyErrorHandler;
  readonly principal?: AdonisPrincipalResolver;
}
