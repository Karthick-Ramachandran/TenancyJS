import type {
  MaybePromise,
  TenancyManager,
  TenantRecord,
} from "tenancyjs-core";
import type {
  ResolverInput,
  TenantResolutionOutcome,
} from "tenancyjs-identifiers";

export interface NestTenantResolver<
  TTenant extends TenantRecord = TenantRecord,
> {
  resolve(input: ResolverInput): MaybePromise<TenantResolutionOutcome<TTenant>>;
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
}

export type NestTenancyResolutionFailure =
  "no-identifier" | "invalid" | "not-found" | "suspended" | "ambiguous";

export interface NestHttpRequest {
  readonly headers?: Readonly<Record<string, unknown>>;
  readonly hostname?: unknown;
  readonly host?: unknown;
}
