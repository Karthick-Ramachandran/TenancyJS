# PRD: Tenant Membership Authorization

## Purpose

Tenant resolution proves a tenant *exists and is active* from client-controllable transport (an
`x-tenant-id` header, host) — never that the authenticated user may *act as* that tenant. With no
membership check, any logged-in user can set the header to another tenant and read/write its data; RLS
does not help because it scopes to whatever tenant was resolved. The library previously neither required
nor guided the check, and the docs demonstrated the insecure default. This feature makes membership
authorization a first-class, fail-closed part of resolution so the spoofable shape cannot ship by
accident. See [[../../adrs/ADR-0035-first-class-tenant-membership-authorization-hook]].

## In Scope

- An `authorize({ tenant, identifier, principal })` hook on `TenantResolutionChain`; a non-`true` result
  fails closed with a `forbidden` outcome that maps to the same sanitized 404 as an unknown tenant.
- A resolution context carrying the app `principal`; integrations extract it from the request.
- Construction requires an explicit decision: `authorize` or `trustResolution`. Neither → throw.
- `trustResolution` cannot bless a *spoofable* resolver (built-in transport resolvers, or any unmarked
  resolver); such a resolver must use `authorize`. `trustedTransport(resolver)` is the explicit opt-out
  for deployments that secure a transport.

## Non-Goals

- Providing the membership store/model — the host owns the user↔tenant relationship.
- Authentication — the app still authenticates; resolution runs after it.
- Fine-grained in-tenant permissions (roles/policies) — this is only "may this principal act as this
  tenant at all."
