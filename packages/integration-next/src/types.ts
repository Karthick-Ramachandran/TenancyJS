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

export interface NextTenantResolver<
  TTenant extends TenantRecord = TenantRecord,
> {
  resolve(
    input: ResolverInput,
    context?: TenantResolutionContext,
  ): MaybePromise<TenantResolutionOutcome<TTenant>>;
}

export type NextTenancyResolutionFailure = TenantResolutionFailureStatus;

export interface NextTenancyOptions<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly manager: TenancyManager<TTenant>;
  readonly resolver: NextTenantResolver<TTenant>;
  /**
   * Resolve the authenticated principal for the current request so the resolver's
   * `authorize` hook can verify tenant membership. Next.js has no `req.user`, so
   * read your session here (e.g. from `cookies()`/`headers()` in the Node runtime).
   */
  readonly principal?: () => MaybePromise<unknown>;
}

export type NextRequestInput = Request | Headers | ResolverInput;

export type NextRouteHandler<TResult = Response> = (
  request: Request,
  ...arguments_: readonly unknown[]
) => MaybePromise<TResult>;

export type NextServerAction<TResult = unknown> = (
  ...arguments_: readonly unknown[]
) => MaybePromise<TResult>;

export interface NextTenancy {
  runWithRequest<TResult>(
    input: NextRequestInput,
    callback: () => MaybePromise<TResult>,
  ): Promise<TResult>;
  withRouteHandler<TArguments extends readonly unknown[], TResult>(
    handler: (
      request: Request,
      ...arguments_: TArguments
    ) => MaybePromise<TResult>,
  ): (request: Request, ...arguments_: TArguments) => Promise<TResult>;
  withServerAction<TArguments extends readonly unknown[], TResult>(
    action: (...arguments_: TArguments) => MaybePromise<TResult>,
  ): (...arguments_: TArguments) => Promise<TResult>;
}
