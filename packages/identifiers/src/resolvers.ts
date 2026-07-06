import { IdentifierConfigurationError } from "./errors.js";
import {
  headerValues,
  normalizeHost,
  normalizeHostValues,
  normalizeIdentifierValues,
} from "./normalization.js";
import type {
  ResolverInput,
  TenantResolver,
  TenantResolverResult,
} from "./types.js";

const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

export interface HeaderTenantResolverOptions {
  readonly headerName?: string;
  readonly id?: string;
}

export class HeaderTenantResolver implements TenantResolver {
  readonly id: string;
  readonly spoofable = true;
  readonly #headerName: string;

  constructor(options: HeaderTenantResolverOptions = {}) {
    const headerName = (options.headerName ?? "x-tenant-id").toLowerCase();
    if (!HEADER_NAME_PATTERN.test(headerName)) {
      throw new IdentifierConfigurationError("Invalid tenant header name.");
    }
    this.#headerName = headerName;
    this.id = validResolverId(options.id ?? `header:${headerName}`);
  }

  resolve(input: ResolverInput): TenantResolverResult {
    const result = normalizeIdentifierValues(
      headerValues(input.headers, this.#headerName),
    );
    if (result.status === "missing")
      return Object.freeze({ status: "no-match" });
    if (result.status === "invalid") {
      return Object.freeze({
        status: "invalid",
        resolverId: this.id,
        reason: result.reason,
      });
    }
    return candidate(this.id, "header", result.value);
  }
}

export interface HostTenantResolverOptions {
  readonly centralDomains?: readonly string[];
  readonly id?: string;
}

export class HostTenantResolver implements TenantResolver {
  readonly id: string;
  readonly spoofable = true;
  readonly #centralDomains: ReadonlySet<string>;

  constructor(options: HostTenantResolverOptions = {}) {
    this.id = validResolverId(options.id ?? "host");
    this.#centralDomains = new Set(
      (options.centralDomains ?? []).map((domain) => validDomain(domain)),
    );
  }

  resolve(input: ResolverInput): TenantResolverResult {
    const result = resolveHost(input);
    if (result.status !== "value") return mapHostResult(this.id, result);
    if (this.#centralDomains.has(result.value)) {
      return Object.freeze({ status: "no-match" });
    }
    return candidate(this.id, "host", result.value);
  }
}

export interface SubdomainTenantResolverOptions {
  readonly centralDomain: string;
  readonly id?: string;
}

export class SubdomainTenantResolver implements TenantResolver {
  readonly id: string;
  readonly spoofable = true;
  readonly #centralDomain: string;

  constructor(options: SubdomainTenantResolverOptions) {
    if (options === null || typeof options !== "object") {
      throw new IdentifierConfigurationError(
        "Subdomain resolver options are required.",
      );
    }
    this.id = validResolverId(options.id ?? "subdomain");
    this.#centralDomain = validDomain(options.centralDomain);
  }

  resolve(input: ResolverInput): TenantResolverResult {
    const result = resolveHost(input);
    if (result.status !== "value") return mapHostResult(this.id, result);
    if (result.value === this.#centralDomain) {
      return Object.freeze({ status: "no-match" });
    }

    const suffix = `.${this.#centralDomain}`;
    if (!result.value.endsWith(suffix)) {
      return Object.freeze({ status: "no-match" });
    }
    const subdomain = result.value.slice(0, -suffix.length);
    if (subdomain.includes(".")) {
      return Object.freeze({
        status: "invalid",
        resolverId: this.id,
        reason: "invalid-host",
      });
    }
    return candidate(this.id, "subdomain", subdomain);
  }
}

/**
 * Assert that a resolver's transport is trusted in your deployment even though it
 * reads request data — e.g. an `x-tenant-id` header set by a gateway that strips
 * the inbound client copy, or service-to-service traffic. Marks the resolver
 * non-spoofable so it may be used with `trustResolution`. Only reach for this when
 * you genuinely control the transport; otherwise use `authorize` to check
 * membership. See ADR-0035.
 */
export function trustedTransport(resolver: TenantResolver): TenantResolver {
  return Object.freeze({
    id: resolver.id,
    spoofable: false,
    resolve: (input: ResolverInput) => resolver.resolve(input),
  });
}

function resolveHost(input: ResolverInput) {
  return normalizeHostValues([
    input.host,
    ...headerValues(input.headers, "host"),
  ]);
}

function mapHostResult(
  resolverId: string,
  result: ReturnType<typeof normalizeHostValues>,
): TenantResolverResult {
  if (result.status === "missing") {
    return Object.freeze({ status: "no-match" });
  }
  if (result.status === "invalid") {
    return Object.freeze({
      status: "invalid",
      resolverId,
      reason: result.reason,
    });
  }
  throw new TypeError("Host result must be missing or invalid.");
}

function candidate(
  resolverId: string,
  kind: string,
  value: string,
): TenantResolverResult {
  return Object.freeze({
    status: "candidate",
    identifier: Object.freeze({ resolverId, kind, value }),
  });
}

function validResolverId(id: string): string {
  if (typeof id !== "string" || id.trim() === "") {
    throw new IdentifierConfigurationError(
      "Resolver id must be a non-empty string.",
    );
  }
  return id;
}

function validDomain(domain: string): string {
  const normalized = normalizeHost(domain);
  if (normalized === null) {
    throw new IdentifierConfigurationError(
      "Central domain must be a valid ASCII hostname.",
    );
  }
  return normalized;
}
