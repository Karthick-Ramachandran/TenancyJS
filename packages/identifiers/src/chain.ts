import type { TenantRecord } from "@tenancyjs/core";

import {
  IdentifierConfigurationError,
  TenantResolutionError,
} from "./errors.js";
import type {
  InvalidIdentifierReason,
  ResolverInput,
  TenantLookupMatch,
  TenantResolutionChainOptions,
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

    this.#options = Object.freeze({
      resolvers: Object.freeze([...options.resolvers]),
      store: options.store,
    });
  }

  async resolve(
    input: ResolverInput,
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
      return Object.freeze({
        status: "resolved",
        identifier: result.identifier,
        tenant: Object.freeze({ ...match.tenant }),
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
