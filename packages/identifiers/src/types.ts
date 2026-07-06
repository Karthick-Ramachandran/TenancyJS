import type { MaybePromise, TenantRecord } from "tenancyjs-core";

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
  /**
   * Whether this resolver reads client-controllable transport (an HTTP header,
   * query, or host) and can therefore be spoofed by the caller. Spoofable
   * resolvers cannot be combined with `trustResolution` — trusting a value the
   * client set *is* the cross-tenant hole — so they must go through `authorize`.
   * Built-in transport resolvers set this `true`; leave it unset (treated as
   * spoofable) unless the source is genuinely unforgeable. To assert a deployment
   * makes a transport trusted (e.g. a gateway that strips inbound client headers),
   * wrap the resolver in {@link trustedTransport}.
   */
  readonly spoofable?: boolean;
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
  | Readonly<{ status: "forbidden"; identifier: TenantIdentifier }>
  | Readonly<{
      status: "resolved";
      identifier: TenantIdentifier;
      tenant: Readonly<TTenant>;
    }>;

/**
 * Per-request data the host supplies to resolution so membership can be checked.
 * `principal` is opaque to the library — typically the authenticated user (and
 * their tenant memberships). Integrations populate it from the request.
 */
export interface TenantResolutionContext {
  readonly principal?: unknown;
}

/**
 * Input to the {@link TenantResolutionChainOptions.authorize} hook: the resolved,
 * active tenant plus the identifier it came from and the request's principal.
 */
export interface TenantAuthorizationInput<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly tenant: Readonly<TTenant>;
  readonly identifier: TenantIdentifier;
  readonly principal: unknown;
}

export interface TenantResolutionChainOptions<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly resolvers: readonly TenantResolver[];
  readonly store: TenantStore<TTenant>;
  /**
   * Verify the authenticated principal may act as the resolved tenant. A resolved
   * identifier only proves the tenant exists and is active — never that this user
   * belongs to it. Return `false` (or anything but `true`) to fail closed. Required
   * unless {@link trustResolution} is set.
   */
  readonly authorize?: (
    input: TenantAuthorizationInput<TTenant>,
  ) => MaybePromise<boolean>;
  /**
   * Explicit opt-out of the membership check: the identifier already comes from a
   * trusted source (a signed claim you validated, service-to-service). Mutually
   * exclusive with {@link authorize}; one of the two is required.
   */
  readonly trustResolution?: boolean;
}
