import type { InvalidIdentifierReason, ResolverHeaderValue } from "./types.js";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/;
const HOST_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export type NormalizedValueResult =
  | Readonly<{ status: "missing" }>
  | Readonly<{ status: "invalid"; reason: InvalidIdentifierReason }>
  | Readonly<{ status: "value"; value: string }>;

export function normalizeIdentifierValues(
  values: readonly ResolverHeaderValue[],
): NormalizedValueResult {
  const flattened = values.flatMap((value) =>
    value === undefined ? [] : typeof value === "string" ? [value] : value,
  );
  if (flattened.length === 0) return Object.freeze({ status: "missing" });

  const normalized: string[] = [];
  for (const value of flattened) {
    const trimmed = value.trim();
    if (trimmed === "") {
      return Object.freeze({ status: "invalid", reason: "empty-value" });
    }
    if (!IDENTIFIER_PATTERN.test(trimmed)) {
      return Object.freeze({ status: "invalid", reason: "invalid-value" });
    }
    normalized.push(trimmed);
  }

  const unique = [...new Set(normalized)];
  return unique.length === 1
    ? Object.freeze({ status: "value", value: unique[0]! })
    : Object.freeze({ status: "invalid", reason: "multiple-values" });
}

export function normalizeHostValues(
  values: readonly ResolverHeaderValue[],
): NormalizedValueResult {
  const flattened = values.flatMap((value) =>
    value === undefined ? [] : typeof value === "string" ? [value] : value,
  );
  if (flattened.length === 0) return Object.freeze({ status: "missing" });

  const normalized: string[] = [];
  for (const value of flattened) {
    const host = normalizeHost(value);
    if (host === null) {
      return Object.freeze({ status: "invalid", reason: "invalid-host" });
    }
    normalized.push(host);
  }

  const unique = [...new Set(normalized)];
  return unique.length === 1
    ? Object.freeze({ status: "value", value: unique[0]! })
    : Object.freeze({ status: "invalid", reason: "multiple-values" });
}

export function normalizeHost(input: string): string | null {
  let host = input.trim().toLowerCase();
  if (
    host === "" ||
    host.length > 259 ||
    containsControlOrWhitespace(host) ||
    host.includes("://") ||
    /[/\\@?#]/.test(host)
  ) {
    return null;
  }

  const colon = host.lastIndexOf(":");
  if (colon >= 0) {
    if (host.indexOf(":") !== colon) return null;
    const port = host.slice(colon + 1);
    if (!/^\d{1,5}$/.test(port) || Number(port) > 65_535) return null;
    host = host.slice(0, colon);
  }

  if (host.endsWith(".")) host = host.slice(0, -1);
  if (host === "" || host.length > 253) return null;

  const labels = host.split(".");
  if (labels.some((label) => !HOST_LABEL_PATTERN.test(label))) return null;
  return host;
}

function containsControlOrWhitespace(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0)!;
    return codePoint <= 0x20 || codePoint === 0x7f;
  });
}

export function headerValues(
  headers: ResolverInputHeaders,
  headerName: string,
): readonly ResolverHeaderValue[] {
  if (headers === undefined) return [];
  return Object.entries(headers)
    .filter(([name]) => name.toLowerCase() === headerName)
    .map(([, value]) => value);
}

type ResolverInputHeaders =
  Readonly<Record<string, ResolverHeaderValue>> | undefined;
