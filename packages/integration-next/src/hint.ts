export const NEXT_TENANCY_HINT_HEADER = "x-tenancy-identity-hint";

const TENANT_HEADER = "x-tenant-id";
const MAX_HINT_LENGTH = 2048;
const SAFE_VALUE = /^[\u0020-\u007e]*$/;

interface IdentityHint {
  readonly v: 1;
  readonly host?: string;
  readonly tenantId?: string;
}

export function createNextTenantHint(input: Request | Headers): string | null {
  const headers = input instanceof Headers ? input : input.headers;
  const host = safeHeaderValue(headers.get("host"));
  const tenantId = safeHeaderValue(headers.get(TENANT_HEADER));
  if (host === undefined && tenantId === undefined) return null;

  const hint: IdentityHint = {
    v: 1,
    ...(host === undefined ? {} : { host }),
    ...(tenantId === undefined ? {} : { tenantId }),
  };
  const encoded = encodeURIComponent(JSON.stringify(hint));
  return encoded.length <= MAX_HINT_LENGTH ? encoded : null;
}

export function withNextTenantHint(input: Request | Headers): Headers {
  const headers = new Headers(input instanceof Headers ? input : input.headers);
  const hint = createNextTenantHint(input);
  if (hint === null) headers.delete(NEXT_TENANCY_HINT_HEADER);
  else headers.set(NEXT_TENANCY_HINT_HEADER, hint);
  return headers;
}

export function parseNextTenantHint(value: string): IdentityHint | null {
  if (value.length === 0 || value.length > MAX_HINT_LENGTH) return null;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value));
    if (parsed === null || typeof parsed !== "object") return null;
    const candidate = parsed as Partial<Record<keyof IdentityHint, unknown>>;
    if (candidate.v !== 1) return null;
    const host = optionalSafeString(candidate.host);
    const tenantId = optionalSafeString(candidate.tenantId);
    if (host === null || tenantId === null) return null;
    if (host === undefined && tenantId === undefined) return null;
    return Object.freeze({
      v: 1,
      ...(host === undefined ? {} : { host }),
      ...(tenantId === undefined ? {} : { tenantId }),
    });
  } catch {
    return null;
  }
}

function optionalSafeString(value: unknown): string | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return null;
  return safeHeaderValue(value) ?? null;
}

function safeHeaderValue(value: string | null): string | undefined {
  if (value === null || value.length === 0 || !SAFE_VALUE.test(value)) {
    return undefined;
  }
  return value;
}
