# ADR-0010: PostgreSQL RLS-Backed Knex And Lucid Isolation

## Status

Accepted

## Context

T-08 adds row-level isolation for Knex and Lucid. Knex exposes a mutable fluent builder but no stable
universal pre-execution rewrite hook; its documented QueryBuilder extension API is experimental.
Appending a predicate early is unsafe because later `orWhere`, `clearWhere`, table changes, raw
fragments, unions, joins, or subqueries can widen or remove it.

Lucid adds model hooks and transactions on top of Knex, but its documented quiet operations,
plain-object reads, bulk mutations, raw/database builders, and relationship paths do not all share one
model hook. A `beforeFind` mixin improves ergonomics but cannot be the whole isolation guarantee.

The first supported database is PostgreSQL 17. The adapter must define its protected surface, RLS
operational requirements, transaction cleanup, central access, Lucid composition, peer versions, and
evidence without claiming every Knex/Lucid capability.

## Decision

1. Publish separate `tenancyjs-adapter-knex` and `tenancyjs-adapter-lucid` packages. Knex depends on
   core and peers on Knex 3.3.x. Lucid remains a distinct public contract, may reuse reviewed Knex
   primitives, and initially peers on Lucid 21.8.x. The proven database is PostgreSQL 17 on Node 22/24.
2. `createKnexTenancy` receives one application-owned `TenancyManager`, a private base Knex instance,
   exhaustive tenant/central table classification, and fixed validated PostgreSQL RLS metadata. It
   exposes callback-scoped protected clients and async policy validation; it never returns the base.
3. Tenant execution uses a managed transaction. Before application SQL, the adapter sets the tenant
   identity through a parameterized transaction-local PostgreSQL setting. Commit, rollback, callback
   failure, and pooled-connection reuse must clear it automatically; session-scoped `SET` is forbidden.
4. Every tenant table must have RLS enabled and forced, with reviewed `USING` and `WITH CHECK` policies
   that fail when context is absent. Runtime validation rejects missing/unforced policies, a superuser/
   `BYPASSRLS` role, table ownership or DDL privileges on protected tables, incompatible metadata, or
   an unverified setting contract. A separate migration role owns schema changes. Runtime never
   installs or alters schema; application migrations own policy DDL.
5. Defense is layered. The protected builder applies/validates the tenant discriminator for every
   supported operation, and PostgreSQL RLS is the final boundary for hook-bypassing or composed SQL.
   Caller filters are grouped under an adapter-owned tenant predicate. Creates inject or validate the
   discriminator; updates cannot change it.
6. The initial Knex matrix supports configured-table select/first/count/basic aggregates, insert/bulk
   insert, update/bulk update, delete/bulk delete, managed transactions/savepoints, allowlisted central
   tables, and explicit core central context. Expansion requires real-database negative tests.
7. Reject raw values/queries, schema/migration/seed APIs, client/connection escape, table replacement,
   truncate, unsafe OR/clear methods, joins, unions, CTEs, arbitrary subqueries, streams, unknown
   properties/operations, unclassified tables, and caller-supplied transactions. These are technical
   enforcement limits, not stylistic restrictions.
8. Explicit core central context may access configured tenant tables through an adapter-owned central
   transaction flag; request input can never select it. Central tables remain separately allowlisted.
   The protected client still rejects raw/schema/client escapes in central mode.
9. `tenancyjs-adapter-lucid` exposes a Lucid-managed transaction service and `TenantScopedModel`
   lifecycle contract. Read/find/fetch/paginate hooks scope models; persistence hooks inject and lock
   the discriminator; all model/query work attaches to the active transaction. Forced RLS remains the
   final boundary for `.pojo()`, quiet, bulk, direct-builder, and relationship behavior.
10. Typed errors disclose only table/model/operation and remediation identifiers—never SQL, bindings,
    tenant values, rows, roles, or database URLs. Stable claims require separate Knex and Lucid
    PostgreSQL conformance suites, package consumers, and Node 22/24 CI.

**Security boundary:** Isolation is guaranteed only for operations listed as supported, executed
through the callback-scoped protected client/model transaction, against validated forced PostgreSQL
RLS policies using a non-bypass application role. Everything else is rejected or unsupported.

**Base-client boundary:** A retained base Knex instance, Lucid database service, privileged role, or
schema without the validated policy contract bypasses TenancyJS and is outside the guarantee.

## Alternatives Considered

- Append `where tenant_id = ?` when a builder is created: rejected because later mutable builder calls
  can remove or widen the predicate.
- Use `Knex.QueryBuilder.extend`: rejected as the primary boundary because Knex marks it experimental
  and it does not reliably constrain all existing/native escape surfaces.
- Use only PostgreSQL RLS with an unrestricted native client: rejected because raw SQL could change
  transaction settings or reach privileged capabilities; the protected surface must also reject escapes.
- Use only Lucid `beforeFind`/`beforeFetch`/`beforeSave` hooks: rejected because documented quiet,
  plain-object, bulk, direct-builder, and relationship paths do not share every hook.
- Claim MySQL/SQLite through query predicates: rejected until an equivalent late enforcement boundary
  and negative tests exist.
- Make every request one transaction without an adapter service: rejected because lifecycle, cleanup,
  pool behavior, and supported-client ownership would be implicit and untestable.

## Consequences

The first Knex/Lucid slice is narrower than the ORMs' full APIs but has a defensible two-layer security
boundary. Native fluent/model ergonomics remain for the supported subset, hook-bypassing Lucid paths
are covered by RLS, and pool cleanup is deterministic.

Applications must install reviewed PostgreSQL policies, use a non-privileged role, keep base clients
private, and run tenant work inside managed callbacks. Tenant HTTP requests hold a transaction for
their supported database scope, increasing connection time and requiring explicit performance and
streaming documentation. Other SQL providers and broader builder composition need later evidence.

## Related Documents

- PRD: `docs/40-features/F-007-knex-lucid-adonis/PRD.md`
- Architecture: `docs/10-architecture/ARCHITECTURE.md`
- Security: `docs/20-security/ADAPTER_SECURITY_CONTRACT.md`
- Feature: `docs/40-features/F-007-knex-lucid-adonis/`
- Knex query builder: `https://knexjs.org/guide/query-builder.html`
- Knex transactions: `https://knexjs.org/guide/transactions.html`
- Lucid model hooks: `https://lucid.adonisjs.com/docs/model-hooks`
- Lucid transactions: `https://lucid.adonisjs.com/docs/transactions`
