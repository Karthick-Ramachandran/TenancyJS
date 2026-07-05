# ADR-0006: Tenant Resolution Outcomes And Portable Test Contracts

## Status

Accepted

## Context

T-03 introduces untrusted HTTP-derived tenant identification and reusable tests that future framework
integrations must run. Returning `TenantRecord | null` cannot distinguish no identifier, malformed
input, unknown tenant, duplicate registry data, or suspension. Coupling test contracts to Vitest would
force a test runner on consumers and adapters.

## Decision

Resolvers are ordered extraction plugins. Each returns no match, an identifier candidate, or a typed
invalid-input result. `TenantResolutionChain` stops at the first resolver that produces a candidate or
invalid result; an explicit higher-priority identifier never falls back after an unknown lookup.

`TenantStore.find` receives the candidate and returns zero or more `{ tenant, status }` matches. The
chain returns a discriminated result: `resolved`, `no-identifier`, `not-found`, `invalid`, `ambiguous`,
or `suspended`. Ambiguous results expose only the identifier and count, not tenant records. Resolution
establishes tenant identity only; authentication and membership authorization remain outside the
module.

Built-in header, full-host, and subdomain resolvers share strict ASCII normalization, reject control
characters and ambiguous multi-values, and never perform network or database access themselves.

`tenancyjs-testing` exposes immutable tenant fixtures and portable contract cases shaped as
`{ name, run }`. Contract cases throw typed assertion errors and have no runtime dependency on Vitest,
Jest, or a framework. Consumers register each case with their chosen test runner.

## Alternatives Considered

- Return tenant or null: too little information for secure framework error mapping and diagnostics.
- Let every resolver query the registry: duplicates persistence logic and prevents consistent ambiguity
  and suspension behavior.
- Fall through when a present header is unknown: permits lower-priority host identity to override an
  explicit but invalid credential and makes precedence unsafe.
- Throw for all invalid input: turns expected untrusted input into exceptions and encourages broad
  error handling; typed results are easier to map deliberately.
- Bind shared contracts to Vitest: convenient internally but imposes tooling and peer-version coupling.

## Consequences

Framework integrations receive exhaustive, non-secret outcomes and one explicit precedence model.
Stores can enforce registry uniqueness while the chain still fails closed on duplicates. Contracts
can run in any test runner. The API is more verbose than tenant-or-null, DNS/IDN normalization is
intentionally limited to already-ASCII hostnames, and framework integrations must map each outcome
without treating `no-identifier` as authenticated central access.

## Related Documents

- PRD: `docs/00-product/PRD.md`
- Architecture: `docs/10-architecture/ARCHITECTURE.md`
- Security: `docs/20-security/SECURITY_MODEL.md`
- Feature: `docs/40-features/F-002-tenant-identification-testing-contracts/PRD.md`
