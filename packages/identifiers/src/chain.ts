import type { TenantRecord } from "tenancyjs-core";

import {
  IdentifierConfigurationError,
  TenantResolutionError,
} from "./errors.js";
import type {
  InvalidIdentifierReason,
  ResolverInput,
  TenantLookupMatch,
  TenantResolutionChainOptions,
  TenantResolutionContext,
  TenantResolutionOutcome,
  TenantResolver,
  TenantResolverResult,
} from "./types.js";

const INVALID_REASONS = new Set([
  "empty-value",
  "multiple-values",
  "invalid-value",
  "invalid-host",
]);

export class TenantResolutionChain<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly #options: TenantResolutionChainOptions<TTenant>;

  constructor(options: TenantResolutionChainOptions<TTenant>) {
    if (
      options === null ||
      typeof options !== "object" ||
      !Array.isArray(options.resolvers) ||
      options.resolvers.length === 0 ||
      options.store === null ||
      typeof options.store !== "object" ||
      typeof options.store.find !== "function"
    ) {
      throw new IdentifierConfigurationError(
        "Resolution chain requires resolvers and a tenant store.",
      );
    }

    const ids = new Set<string>();
    for (const resolver of options.resolvers) {
      if (
        resolver === null ||
        typeof resolver !== "object" ||
        typeof resolver.id !== "string" ||
        resolver.id.trim() === "" ||
        typeof resolver.resolve !== "function"
      ) {
        throw new IdentifierConfigurationError("Invalid tenant resolver.");
      }
      if (ids.has(resolver.id)) {
        throw new IdentifierConfigurationError(
          `Resolver id "${resolver.id}" is registered more than once.`,
        );
      }
      ids.add(resolver.id);
    }

    // A resolved identifier proves only that the tenant exists and is active — never
    // that the authenticated principal may act as it. Force an explicit decision at
    // construction: either check membership with `authorize`, or opt out with
    // `trustResolution` for a trusted caller. Neither → fail loud now, not leak later.
    const hasAuthorize = typeof options.authorize === "function";
    const trusted = options.trustResolution === true;
    if (hasAuthorize && trusted) {
      throw new IdentifierConfigurationError(
        "Pass either authorize() or trustResolution: true, not both.",
      );
    }
    if (!hasAuthorize && !trusted) {
      throw new IdentifierConfigurationError(
        "Tenant resolution has no membership check. A resolved tenant identifier is not proof " +
          "that the user may act as that tenant — a client that can set the identifier (e.g. an " +
          "x-tenant-id header) could otherwise reach any tenant. Pass authorize({ tenant, principal }) " +
          "to verify membership, or set trustResolution: true if the identifier already comes from a " +
          "trusted source (a signed claim you validated, or service-to-service). See ADR-0035.",
      );
    }
    // trustResolution asserts the identifier is not client-forgeable. A spoofable
    // resolver (a raw header/host) contradicts that — trusting a value the client
    // set is the cross-tenant hole itself — so the two cannot be combined. A
    // spoofable resolver must go through authorize (or be wrapped in
    // trustedTransport to explicitly assert the deployment secures its transport).
    if (trusted) {
      const spoofable = options.resolvers.find(
        (resolver) => resolver.spoofable !== false,
      );
      if (spoofable !== undefined) {
        throw new IdentifierConfigurationError(
          `trustResolution cannot bless resolver "${spoofable.id}": it reads client-controllable ` +
            "transport (e.g. an x-tenant-id or Host header) that a caller can spoof, and trusting a " +
            "spoofable value is exactly the cross-tenant hole. Use authorize() to check membership, or " +
            "wrap it in trustedTransport() only if your deployment makes this transport trusted (a " +
            "gateway that strips inbound client headers, or service-to-service). See ADR-0035.",
        );
      }
    }

    this.#options = Object.freeze({
      resolvers: Object.freeze([...options.resolvers]),
      store: options.store,
      ...(hasAuthorize ? { authorize: options.authorize } : {}),
      trustResolution: trusted,
    });
  }

  async resolve(
    input: ResolverInput,
    context?: TenantResolutionContext,
  ): Promise<TenantResolutionOutcome<TTenant>> {
    for (const resolver of this.#options.resolvers) {
      let result: TenantResolverResult;
      try {
        result = validateResolverResult(
          resolver,
          await resolver.resolve(input),
        );
      } catch (error) {
        throw new TenantResolutionError(resolver.id, error);
      }

      if (result.status === "no-match") continue;
      if (result.status === "invalid") return Object.freeze({ ...result });

      let matches: readonly TenantLookupMatch<TTenant>[];
      try {
        matches = await this.#options.store.find(result.identifier);
        validateMatches(matches);
      } catch (error) {
        throw new TenantResolutionError("tenant-store", error);
      }

      if (matches.length === 0) {
        return Object.freeze({
          status: "not-found",
          identifier: result.identifier,
        });
      }
      if (matches.length > 1) {
        return Object.freeze({
          status: "ambiguous",
          identifier: result.identifier,
          matchCount: matches.length,
        });
      }

      const match = matches[0]!;
      if (match.status === "suspended") {
        return Object.freeze({
          status: "suspended",
          identifier: result.identifier,
        });
      }

      // Membership gate: the tenant exists and is active, but only now do we check
      // that this principal may act as it. A non-`true` result fails closed; a thrown
      // authorize (e.g. a lookup error) surfaces as a resolution error, not a silent
      // allow. When trustResolution is set there is no authorize and this is skipped.
      const tenant = Object.freeze({ ...match.tenant });
      if (this.#options.authorize !== undefined) {
        let allowed: boolean;
        try {
          allowed = await this.#options.authorize({
            tenant,
            identifier: result.identifier,
            principal: context?.principal,
          });
        } catch (error) {
          throw new TenantResolutionError("authorize", error);
        }
        if (allowed !== true) {
          return Object.freeze({
            status: "forbidden",
            identifier: result.identifier,
          });
        }
      }
      return Object.freeze({
        status: "resolved",
        identifier: result.identifier,
        tenant,
      });
    }

    return Object.freeze({ status: "no-identifier" });
  }
}

function validateMatches<TTenant extends TenantRecord>(
  matches: readonly TenantLookupMatch<TTenant>[],
): void {
  if (!Array.isArray(matches)) {
    throw new TypeError("Tenant store must return an array of matches.");
  }
  for (const match of matches) {
    if (
      match === null ||
      typeof match !== "object" ||
      (match.status !== "active" && match.status !== "suspended") ||
      match.tenant === null ||
      typeof match.tenant !== "object" ||
      typeof match.tenant.id !== "string" ||
      match.tenant.id.trim() === ""
    ) {
      throw new TypeError("Tenant store returned an invalid match.");
    }
  }
}

function validateResolverResult(
  resolver: TenantResolver,
  result: unknown,
): TenantResolverResult {
  if (result === null || typeof result !== "object" || !("status" in result)) {
    throw new TypeError("Resolver returned an invalid result.");
  }
  if (result.status === "no-match") {
    return Object.freeze({ status: "no-match" });
  }
  if (result.status === "invalid") {
    if (
      !("reason" in result) ||
      typeof result.reason !== "string" ||
      !INVALID_REASONS.has(result.reason)
    ) {
      throw new TypeError("Resolver returned an invalid reason.");
    }
    return Object.freeze({
      status: "invalid",
      resolverId: resolver.id,
      reason: result.reason as InvalidIdentifierReason,
    }) as TenantResolverResult;
  }
  if (
    result.status !== "candidate" ||
    !("identifier" in result) ||
    result.identifier === null ||
    typeof result.identifier !== "object" ||
    !("kind" in result.identifier) ||
    typeof result.identifier.kind !== "string" ||
    !/^[a-z][a-z0-9-]{0,63}$/.test(result.identifier.kind) ||
    !("value" in result.identifier) ||
    typeof result.identifier.value !== "string" ||
    result.identifier.value.trim() === "" ||
    result.identifier.value.length > 1024 ||
    [...result.identifier.value].some((character) => {
      const codePoint = character.codePointAt(0)!;
      return codePoint <= 0x20 || codePoint === 0x7f;
    })
  ) {
    throw new TypeError("Resolver returned an invalid candidate.");
  }
  return Object.freeze({
    status: "candidate",
    identifier: Object.freeze({
      resolverId: resolver.id,
      kind: result.identifier.kind,
      value: result.identifier.value,
    }),
  });
}
