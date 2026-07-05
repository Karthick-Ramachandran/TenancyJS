import type { ResolverHeaderValue, ResolverInput } from "tenancyjs-identifiers";

import { NestTenancyConfigurationError } from "./errors.js";
import type { NestHttpRequest } from "./types.js";

export function createNestResolverInput(request: unknown): ResolverInput {
  if (request === null || typeof request !== "object") {
    throw new NestTenancyConfigurationError(
      "Nest tenancy requires an HTTP request object.",
    );
  }
  const source = request as NestHttpRequest;
  const headers: Record<string, ResolverHeaderValue> = {};
  for (const [name, value] of Object.entries(source.headers ?? {})) {
    const normalized = normalizeHeader(value);
    if (normalized !== undefined) headers[name.toLowerCase()] = normalized;
  }
  const explicitHost =
    typeof source.hostname === "string"
      ? source.hostname
      : typeof source.host === "string"
        ? source.host
        : undefined;
  const host = explicitHost ?? headers.host;
  return Object.freeze({
    ...(host === undefined ? {} : { host }),
    headers: Object.freeze(headers),
  });
}

function normalizeHeader(value: unknown): ResolverHeaderValue {
  if (typeof value === "string") return value;
  if (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === "string")
  ) {
    return Object.freeze([...value]) as readonly string[];
  }
  return undefined;
}
