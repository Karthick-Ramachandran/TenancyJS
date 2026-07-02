# ADR-0007: Prisma Row Level Isolation Contract

## Status

Accepted

## Context

T-04 introduces the first ORM isolation boundary. Prisma Client query extensions can intercept
top-level model and raw operations and can modify query arguments, but Prisma documents that query
extensions do not support nested read/write operations as independent hooks. A generic best-effort
rewriter would therefore create an unsafe compatibility claim.

The adapter must also define how missing/central context behaves, how every model is classified, how
tenant fields are protected, how transactions retain context, which Prisma versions are supported,
and where the reusable `TenancyAdapter` contract lives.

## Decision

1. Add ORM-neutral `TenancyAdapter` name, strategy, capability, and validation-result types to
   `@tenancyjs/core`. They are data-only contracts; core imports no Prisma code and implements no query
   behavior.
2. Publish the Prisma implementation separately as `@tenancyjs/adapter-prisma`, depending on core and
   declaring the CI-tested Prisma Client version as a peer. The initial compatibility target is Prisma
   7.8.x on current Node 22 and Node 24 lanes; broader ranges require explicit CI evidence.
3. Expose a shareable query extension factory applied with `prisma.$extends(...)`. It reads context
   only from the supplied `TenancyManager`, never mutates the base client, and calls only the callback's
   `query(args)` so active transaction semantics are preserved.
4. Require exhaustive model classification. Tenant-scoped models specify a tenant discriminator and
   relation metadata; central models are separately allowlisted. Overlap, invalid configuration, and
   any observed unregistered model fail before delegation.
5. For tenant context, compose caller filters with the current tenant predicate through `AND`; inject
   the discriminator on create/bulk-create; reject conflicting create values and all attempts to update
   the discriminator. Explicit core central context bypasses tenant predicates for reviewed
   administrative work. Missing context fails for tenant-scoped models. Central models pass through
   only when allowlisted.
6. Support only top-level operations proven by the operation-policy and PostgreSQL conformance matrix:
   unique/first/many reads, create/upsert, update/delete, bulk variants, count, aggregate/groupBy, and
   transaction execution that reaches those model operations. Unknown operations fail closed.
7. Reject any operation that Prisma does not expose for reliable tenant enforcement. This includes
   raw operations, nested relation reads/writes, and relation traversal beyond the supported
   interception surface. Raw operations are rejected because Prisma does not expose a reliable
   mechanism to enforce tenant isolation for arbitrary SQL; the adapter guarantees isolation only for
   supported Prisma Client operations. Future support requires a superseding or follow-up accepted ADR
   plus negative isolation tests.
8. Add a runner-neutral two-tenant row-level adapter contract to `@tenancyjs/testing`; stable Prisma
   claims require real PostgreSQL, Node/peer-version CI, and clean package-consumer evidence.
9. Report typed errors using model/operation identifiers only. Do not include query arguments, row
   data, tenant records, or database connection values.

**Security boundary:** The adapter guarantees tenant isolation only for the operations explicitly
listed in this ADR. All other Prisma capabilities are outside the adapter's security boundary and are
rejected or unsupported.

**Extended-client boundary:** Only the Prisma client returned by `prisma.$extends(...)` is protected.
Applications that retain and use an unextended Prisma client bypass TenancyJS guarantees.

## Alternatives Considered

- Rewrite all nested reads/writes recursively: rejected because Prisma does not expose nested
  operations as query-extension hooks, relation shapes are schema-specific, and silent partial coverage
  would create a cross-tenant leak risk.
- Permit raw queries in tenant context and inject SQL predicates: rejected because SQL/TypedSQL cannot
  be transformed generically and safely across providers.
- Allow unknown models as central: rejected because schema growth would silently bypass isolation.
- Put the Prisma adapter in core: rejected because it violates the accepted package dependency boundary
  and couples core to Prisma releases.
- Introduce a new base-adapter package: deferred because the initial contract is small, ORM-neutral,
  and can live in core without another published dependency; measured growth may justify a later ADR.
- Use Prisma middleware: rejected because Client Extensions are the current supported composition
  surface and produce an independently exposable extended client.
- Claim Prisma 6 and 7 immediately: rejected until both ranges have dedicated CI evidence.

## Consequences

The initial adapter has a narrow, auditable security boundary and fails when Prisma cannot provide
reliable interception. Supported top-level operations share one contract and can be reused by future
adapters. Central work remains explicit and nested/raw escape paths are visible rather than silently
unsafe.

Applications must expose the extended client consistently and restructure or separately review nested
relation/raw workloads. Core gains a small adapter vocabulary and its module memory must reflect that
type ownership. Prisma major-version updates require compatibility review and CI. Database-per-tenant
remains a later capability rather than being conflated with row-level behavior.

## Related Documents

- PRD: `docs/00-product/PRD.md`
- Architecture: `docs/10-architecture/ARCHITECTURE.md`
- Security: `docs/20-security/SECURITY_MODEL.md`
- Feature: `docs/40-features/F-003-prisma-adapter/`
- Module: `docs/30-modules/prisma-adapter/MODULE.md`
- Prisma query extensions: `https://www.prisma.io/docs/orm/prisma-client/client-extensions/query`
- Prisma extension limitations: `https://www.prisma.io/docs/orm/prisma-client/client-extensions`
- Shared extension transaction guidance:
  `https://www.prisma.io/docs/orm/prisma-client/client-extensions/shared-extensions`
