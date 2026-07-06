# Acceptance Criteria: Tenant Membership Authorization

## Criteria

- Constructing a `TenantResolutionChain` with neither `authorize` nor `trustResolution` throws
  `IdentifierConfigurationError`; passing both also throws.
- `trustResolution: true` with a spoofable resolver (e.g. `HeaderTenantResolver`, or an unmarked custom
  resolver) throws; `trustResolution` with `trustedTransport(resolver)` (non-spoofable) succeeds.
- With `authorize` returning `false`, resolving a real, active tenant yields `status: "forbidden"`; the
  hook receives `{ tenant, identifier, principal }`.
- An `authorize` that throws surfaces as a `TenantResolutionError` (not a silent allow).
- `describeTenantResolutionFailure("forbidden")` returns 404 with the identical message to `"not-found"`
  (no tenant-enumeration leak).
- Integrations pass the request principal into resolution and map `forbidden` to the sanitized 404.

## Out Of Scope

- The host's membership table/query.
- Authentication and in-tenant role/permission checks.
