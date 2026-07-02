import type { MaybePromise, TenantRecord } from "@tenancyjs/core";

export type ResolverHeaderValue = string | readonly string[] | undefined;

export interface ResolverInput {
  readonly host?: ResolverHeaderValue;
  readonly headers?: Readonly<Record<string, ResolverHeaderValue>>;
}

export interface TenantIdentifier {
  readonly resolverId: string;
  readonly kind: string;
  readonly value: string;
}

export type InvalidIdentifierReason =
  "empty-value" | "multiple-values" | "invalid-value" | "invalid-host";

export type TenantResolverResult =
  | Readonly<{ status: "no-match" }>
  | Readonly<{ status: "candidate"; identifier: TenantIdentifier }>
  | Readonly<{
      status: "invalid";
      resolverId: string;
      reason: InvalidIdentifierReason;
    }>;

export interface TenantResolver {
  readonly id: string;
  resolve(input: ResolverInput): MaybePromise<TenantResolverResult>;
}

export type TenantLookupStatus = "active" | "suspended";

export interface TenantLookupMatch<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly tenant: TTenant;
  readonly status: TenantLookupStatus;
}

export interface TenantStore<TTenant extends TenantRecord = TenantRecord> {
  find(
    identifier: TenantIdentifier,
  ): MaybePromise<readonly TenantLookupMatch<TTenant>[]>;
}

export type TenantResolutionOutcome<
  TTenant extends TenantRecord = TenantRecord,
> =
  | Readonly<{ status: "no-identifier" }>
  | Readonly<{ status: "not-found"; identifier: TenantIdentifier }>
  | Readonly<{
      status: "invalid";
      resolverId: string;
      reason: InvalidIdentifierReason;
    }>
  | Readonly<{
      status: "ambiguous";
      identifier: TenantIdentifier;
      matchCount: number;
    }>
  | Readonly<{ status: "suspended"; identifier: TenantIdentifier }>
  | Readonly<{
      status: "resolved";
      identifier: TenantIdentifier;
      tenant: Readonly<TTenant>;
    }>;

export interface TenantResolutionChainOptions<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly resolvers: readonly TenantResolver[];
  readonly store: TenantStore<TTenant>;
}
