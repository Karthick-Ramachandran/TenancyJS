# Module: Tenant Identifiers

## Purpose

Convert untrusted request metadata into exhaustive, framework-neutral tenant resolution outcomes.

## Owns

- Resolver/store/outcome contracts, precedence, input normalization, built-in header/host/subdomain
  resolvers, ambiguity and suspension mapping.

## Does Not Own

- Authentication, membership authorization, persistence clients, caching, network, middleware, tenant
  context initialization, custom-domain verification, JWT verification, or path routing.

## Public Interfaces

- `TenantResolver`, `TenantStore`, `TenantResolutionChain`, `TenantResolutionOutcome`.
- `HeaderTenantResolver`, `HostTenantResolver`, `SubdomainTenantResolver`.
- Normalized identifier/input/result types and typed configuration errors.

## Boundaries

Depends only on public `tenancyjs-core` types. Framework integrations call this module and decide how
to map outcomes. It never calls `TenancyManager` or selects central context. Feature source:
`docs/40-features/F-002-tenant-identification-testing-contracts/`.
