# Adapter Security Contract

## Purpose

TenancyJS adapters guarantee tenant isolation only for ORM operations explicitly marked `supported`
in that adapter's published operation matrix. If an operation cannot be reliably intercepted,
transformed, and proven through conformance tests, the secured client must fail before execution.

This fail-closed rule is the product boundary. Package presence or ORM composability is never evidence
that an operation is protected.

## Conditions Of The Guarantee

The adapter guarantee applies only when all of these conditions hold:

1. The host resolves and validates the tenant once at the request/job boundary and enters a lexical
   `TenancyManager.runWithTenant` scope.
2. Tenant-aware application code receives only the adapter's secured/extended ORM client.
3. Every model, tenant discriminator, central model, and relation field is classified accurately and
   startup validation has been reviewed.
4. The operation is listed as `supported` for the exact adapter/ORM version exercised in CI.
5. No unreviewed ORM extension, hook, plugin, or base client runs after/beside the tenancy enforcement
   boundary and changes scoped arguments.

Within those conditions, supported operations preserve caller intent, add or validate tenant scope,
and cannot observe or mutate a different tenant in the conformance suite.

## What Adapters Must Guarantee

- Missing tenant context fails before a tenant-owned query executes.
- Caller filters cannot replace the adapter's tenant predicate.
- Creates receive or validate the active tenant discriminator; updates cannot move a record between tenants.
- Bulk, aggregate, unique, and transaction behavior is scoped wherever the matrix marks it supported.
- Central models and administrative context are explicit, reviewed capabilities.
- Errors disclose operation/model identifiers and remediation, not rows, arguments, SQL, tenants, or credentials.
- Tenant identity is read from core context in memory. Adapters do not resolve the tenant or query a
  registry on every ORM operation.

Adapters do not authenticate users or authorize tenant membership. The host application completes
those checks before entering tenant context.

## Secured Client Boundary

Only the client returned or wrapped by the adapter is protected. An original/unextended ORM client is
outside the TenancyJS security boundary. Applications should construct the base client in one module,
apply the tenancy adapter last, and export only the secured client to tenant-aware code.

## Raw And Uninterceptable Operations

Adapters reject any operation that cannot be reliably intercepted and enforced. For Prisma this
includes raw SQL because Prisma does not expose a generic, provider-independent mechanism that can
prove and inject tenant predicates into arbitrary SQL. It also includes nested relation operations
that Prisma query extensions do not expose as independent reliable hooks.

This is a technical enforcement boundary, not a preference. Raw or nested behavior can be added only
when an adapter has a reliable interception mechanism and negative isolation tests for it.

## Capability States

- `supported`: enforced and covered by the adapter's conformance/compatibility evidence.
- `rejected`: the secured surface detects the operation and fails before delegation.
- `unsupported`: the adapter does not implement the capability and makes no guarantee.

Unknown models and operations are always rejected. There is no best-effort state.

## Evidence Required To Expand Support

Every new supported operation requires:

- an accepted architecture/security decision when the boundary changes;
- unit tests for transformation and rejection paths;
- two-tenant negative tests against the real ORM and production database baseline;
- transaction and error-path evidence where applicable;
- package-consumer and supported-version CI;
- an updated operation matrix, migration guide, security review, and completion report.

## Adapter Matrices

The repository-wide status is in `docs/50-quality/ADAPTER_OPERATION_MATRIX.md`. Each implemented
adapter package must publish its detailed matrix beside its usage documentation.
