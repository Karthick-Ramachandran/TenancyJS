import type {
  MaybePromise,
  TenancyManager,
  TenantRecord,
} from "@tenancyjs/core";
import type {
  ResolverInput,
  TenantResolutionOutcome,
} from "@tenancyjs/identifiers";

export interface NextTenantResolver<
  TTenant extends TenantRecord = TenantRecord,
> {
  resolve(input: ResolverInput): MaybePromise<TenantResolutionOutcome<TTenant>>;
}

export type NextTenancyResolutionFailure =
  "no-identifier" | "invalid" | "not-found" | "suspended" | "ambiguous";

export interface NextTenancyOptions<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly manager: TenancyManager<TTenant>;
  readonly resolver: NextTenantResolver<TTenant>;
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
