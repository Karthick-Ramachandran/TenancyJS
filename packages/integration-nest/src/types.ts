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

export interface NestTenantResolver<
  TTenant extends TenantRecord = TenantRecord,
> {
  resolve(
    input: ResolverInput,
    context?: TenantResolutionContext,
  ): MaybePromise<TenantResolutionOutcome<TTenant>>;
}

export interface NestTenancyExecutor {
  run<TResult>(callback: () => MaybePromise<TResult>): Promise<TResult>;
}

export interface NestTenancyOptions<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly manager: TenancyManager<TTenant>;
  readonly resolver: NestTenantResolver<TTenant>;
  readonly executor?: NestTenancyExecutor;
  /**
   * Extract the authenticated principal from the request so the resolver's
   * `authorize` hook can verify tenant membership (e.g. `(req) => req.user`).
   * The guard runs after your authentication guards, so the principal is set.
   */
  readonly principal?: (request: unknown) => unknown;
}

export type NestTenancyResolutionFailure = TenantResolutionFailureStatus;

export interface NestHttpRequest {
  readonly headers?: Readonly<Record<string, unknown>>;
  readonly hostname?: unknown;
  readonly host?: unknown;
}
