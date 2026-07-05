/**
 * The non-resolved statuses of a `TenantResolutionOutcome`. Framework
 * integrations map these to safe HTTP responses; the mapping lives here so it
 * cannot drift between Express, Next.js, AdonisJS, and future integrations.
 */
export type TenantResolutionFailureStatus =
  "no-identifier" | "invalid" | "not-found" | "suspended" | "ambiguous";

export interface TenantResolutionFailureHttp {
  readonly message: string;
  readonly status: 400 | 404 | 500;
}

/**
 * Map a resolution failure to a safe HTTP status and message. Deliberately
 * coarse — `not-found` and `suspended` both surface as 404 so a caller cannot
 * distinguish an unknown tenant from a suspended one.
 */
export function describeTenantResolutionFailure(
  status: TenantResolutionFailureStatus,
): TenantResolutionFailureHttp {
  switch (status) {
    case "no-identifier":
      return { message: "Tenant identity is required.", status: 400 };
    case "invalid":
      return { message: "Tenant identity is invalid.", status: 400 };
    case "not-found":
    case "suspended":
      return { message: "Tenant was not found.", status: 404 };
    case "ambiguous":
      return { message: "Tenant resolution is unavailable.", status: 500 };
  }
}
