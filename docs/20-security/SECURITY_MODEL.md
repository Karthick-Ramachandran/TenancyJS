# Security Model

## Status

Active and incremental. Core async context, fail-closed tenant access, explicit central scope,
lifecycle cleanup, tenant resolution, Prisma/Knex/Lucid row-level isolation, PostgreSQL
schema-per-tenant isolation for Knex/Lucid, Express and Next.js request lifecycle boundaries, and the
reference safe CLI foundation are implemented and tested. Database-per-tenant routing is implemented
for Knex, Lucid, and Prisma, and database-enforced schema roles are implemented for Knex. Other
adapters, provisioning, and operational CLI commands remain later tasks.

## Baseline Rules

- Never commit secrets or credentials, and never read or copy `.env` files into docs.
- Validate and authorize untrusted input at every trust boundary.
- Do not add network, telemetry, cloud, MCP runtime, or AI API behavior without explicit review.
- Adapter guarantees follow `docs/20-security/ADAPTER_SECURITY_CONTRACT.md`; unsupported operations
  fail instead of executing with best-effort isolation.

## Authentication And Authorization

TenancyJS resolves and propagates tenant identity; it does not authenticate end users. Framework
integrations accept only resolver outputs that the application has configured as trusted. Header,
host, path, or token-derived tenant identifiers are untrusted until validated and resolved against
the tenant registry. Tenant membership and application authorization remain the host application's
responsibility and must occur after tenant resolution.

Central-context and unsafe-bypass operations are privileged capabilities. They must be explicit APIs,
must never be selected from raw request input, and must not silently follow a resolver failure.

## Secrets And Configuration

Secrets are injected by the host application through environment variables or its secret manager.
Generated config and diagnostic output must never contain connection credentials. `tenancy doctor`
and `--json` output redact secret-valued fields. The CLI may update `.env.example` with variable
names and placeholders only; it never reads or copies `.env` values into generated files or logs.

## Sensitive Data

Tenant identifiers, domains, and database connection references are sensitive operational metadata.
The host application owns encryption at rest and transport security. TenancyJS avoids logging tenant
records or database URLs by default. Cross-tenant read, update, delete, aggregate, nested-write, and
transaction isolation are mandatory adapter conformance tests.

## Dependencies And Supply Chain

Runtime dependencies are kept minimal and packages use explicit peer ranges for framework and ORM
versions. Every supported peer range is exercised in CI before it is advertised. The CLI delegates
only to locally installed, allowlisted ORM executables using argument arrays rather than a shell.

## Trust Boundaries And Invariants

- Tenant context uses async-scope propagation; no mutable global tenant value is allowed.
- Tenant-aware operations without context fail closed in strict mode, which is the default.
- Unknown, malformed, suspended, or ambiguous tenants never become central context automatically.
- Central context and unsafe raw access are explicit and cannot be activated by user-controlled data.
- Cleanup runs in `finally`, including nested contexts and thrown/rejected handlers.
- Generated file paths are constrained to the target project; symlinks and traversal are rejected.
- Existing project files are not overwritten without a conflict report and explicit user approval.

## Implemented Core Controls

- `TenancyManager` exposes lexical tenant and central scopes only; there is no imperative global
  initialize/end pair.
- `getTenantOrFail` throws `TenantContextError` for missing and central scopes.
- Tenant records are shallow-cloned and frozen before lifecycle code observes them.
- Completed bootstrappers revert in reverse order, and cleanup continues after individual failures.
- `TenancyLifecycleError` preserves the primary failure and every cleanup failure.
- Core has no runtime dependencies, network, telemetry, storage, file-write, cloud, MCP, or AI behavior.

## Implemented Identification Controls

- Resolver precedence is explicit; present invalid/unknown high-priority identifiers never fall back.
- Header and ASCII host inputs reject ambiguity, controls, whitespace, schemes, paths, and userinfo.
- Custom resolver output is validated and stamped with the configured resolver ID before lookup.
- Registry duplicates and suspension return exhaustive non-secret outcomes rather than tenant records.
- Resolution establishes tenant identity only and never authenticates membership or selects central mode.

## Implemented Prisma Adapter Controls

- Every observed model must be configured as tenant-scoped or central; unknown/overlapping models fail.
- Model/relation classification is host-supplied and must be reviewed against every schema change;
  adapter validation reports that unverifiable boundary as a warning.
- Supported top-level operations preserve caller filters and append the active tenant predicate.
- Create operations inject/validate the discriminator; updates cannot change it.
- Raw operations, nested relation operations, relation traversal, and unknown operations are rejected.
- The security boundary is only the returned extended client; a retained base client bypasses it.
- Central-model access is allowlisted and explicit central context is the only tenant-model bypass.
- Query callbacks delegate exactly once through Prisma's provided callback so transactions retain scope.
- Errors contain model/operation identifiers but never query arguments, rows, tenants, or database URLs.
- The tenancy extension must be registered last so later query extensions cannot remove scoped arguments.

## Implemented Knex Adapter Controls

- The initial guarantee is Knex 3.3 with PostgreSQL 17 forced RLS on Node 24; other SQL providers
  remain unsupported until equivalent enforcement and real-database evidence exist.
- Protected execution stays locked until startup validation confirms enabled/forced policies, reviewed
  `USING`/`WITH CHECK` expressions, and a runtime role that is not owner, superuser, or `BYPASSRLS`.
- Tenant work uses parameterized transaction-local settings and a callback-scoped protected client;
  commit, rollback, savepoints, failure, and pooled reuse are covered by PostgreSQL tests.
- Supported builders add or validate the discriminator and compose only reviewed AND filters. Raw SQL,
  raw values, schema/migration/client/connection access, unsafe OR/clear, joins, unions, CTEs,
  subqueries, streams, truncate, caller transactions, and unknown tables/operations are rejected.
- The base Knex client and migration role remain private and outside the guarantee. Runtime never
  installs schema or policies automatically.
- Schema-per-tenant is adapter-enforced: the shared engine validates a host-resolved schema, rejects
  central collisions and qualified table names, verifies runtime-role access/table presence, and sets
  transaction-local `search_path`. Tenant identity and schema are retained as a one-to-one mapping for
  the engine lifetime; remapping or assigning one schema to two tenants fails closed. The protected
  client exposes no raw or cross-placement surface.

## Implemented Lucid Adapter Controls

- The initial guarantee targets Lucid 22.4, AdonisJS 7.3, PostgreSQL 17, and Node 24. Non-PostgreSQL
  providers and AdonisJS 6 remain unsupported.
- `createLucidTenancy` stays locked until forced-policy validation passes, then owns a managed Lucid
  transaction with parameterized transaction-local tenant/central settings.
- Explicitly registered models receive find/fetch/paginate/save/delete hooks. Reads add the tenant
  predicate; creates inject or validate the discriminator; updates cannot move rows between tenants;
  all normal model work attaches to the active transaction.
- `.pojo()`, quiet persistence, bulk/direct builders, and unsupported relationship writes skip model
  hooks by Lucid design. They receive no protected transaction and must fail closed through forced RLS;
  they are not advertised as supported operations.
- The application-owned Lucid database service, unregistered models, privileged roles, and unforced
  schemas are outside the adapter guarantee. Runtime never installs schema or policies.
- In schema-per-tenant mode registered models use unqualified tables and the shared managed
  transaction's local `search_path`; no discriminator is injected. The central schema must not contain
  tenant-table names; validation also checks every effective default-search-path schema. Therefore
  `.pojo()`, quiet, bulk, and direct unqualified hook-bypass paths fail closed. The shared engine also
  rejects tenant/schema mapping collisions for the adapter lifetime.

## Implemented TypeORM And Sequelize Controls

- TypeORM 1 and stable Sequelize 6 expose only callback-scoped plain-value CRUD/count facades. Native
  data sources, managers, repositories/models, instances, query builders, raw SQL, relations/includes,
  schema sync, and migrations remain outside the boundary.
- Plain scalar equality is the only initial filter form. Tenant filters are composed, creates inject or
  validate the discriminator, and updates cannot move rows. Forced PostgreSQL RLS remains the final
  boundary and startup validation is mandatory.
- ORM transactions are adapter-owned and transaction-local tenant settings revert on completion.

## Implemented Mongoose Controls

- Mongoose row-level isolation is adapter-enforced. The protected facade accepts plain scalar equality,
  passes one managed session to every operation, and returns lean plain values rather than live
  documents. Native models/queries/collections/connections, populate, aggregation, and raw driver access
  remain outside the boundary.
- Validation requires a reachable replica set and reports the weaker enforcement tier as a warning.
  Transactions provide rollback/session lifecycle; they do not turn document filters into a database
  authorization policy.

## Implemented NestJS Controls

- Marked NestJS 11 routes resolve exactly once in a guard. A private WeakMap carries the frozen result
  to an interceptor; failures never enter central context.
- Authorization guards may read resolved identity, while canonical tenant and optional ORM scope cover
  the handler Observable until completion, error, or cancellation. Express and Fastify platforms share
  this contract without platform-specific tenant state.

## Isolation Enforcement Tiers

- Forced PostgreSQL RLS is **database-enforced** for supported row-level Knex/Lucid operations when the
  reviewed runtime-role conditions hold.
- Prisma query rewriting and default schema-per-tenant `search_path` are **adapter-enforced**. Retaining
  a base/raw client bypasses those guarantees. They must not be presented as equivalent to forced RLS.
- A configured per-tenant PostgreSQL role makes schema-per-tenant database-enforced for that scope:
  transaction-local role and search path state revert before a pooled connection is reused.
- Database-per-tenant is database-enforced when the host placement resolver connects each opaque key
  to the intended separate database. The host-owned resolver/factory remains part of that boundary.

## Database-Per-Tenant Resource Lifecycle

- The shared cache has an explicit capacity, single-flight creation, reference-counted leases, idle LRU
  eviction, and deterministic shutdown. It never evicts an active resource or exceeds capacity.
- Tenant identity and opaque placement keys are one-to-one while cached; collisions fail before
  resource creation or callback execution. Placement keys reject URL/credential-shaped values.
- Creation/destruction failures are sanitized. Failed creation is not cached; failed destruction is
  retained for retry rather than losing ownership of a possibly live pool.
- Knex/Lucid `validate()` verifies database-per-tenant configuration but reports a warning that the
  open-ended set of tenant factories and connections is checked only when each tenant is first used.
- Host factories own credentials and the correctness of key-to-database placement; placement metadata
  and cache diagnostics never contain connection URLs.
- A Prisma routed client is callback-scoped. Returning, storing, or using it after the callback settles
  is unsupported because its cache lease has ended and eviction may disconnect it.

## Implemented Express Integration Controls

- Applications supply the canonical manager and resolution service; the integration creates no hidden
  tenant state, registry, adapter, or central-mode path.
- Only a `resolved` outcome enters `runWithTenant`; every other outcome fails before tenant routes.
- Missing/invalid identity uses sanitized 400 errors; unknown and suspended tenants share one generic
  404 mapping; ambiguous registry data maps to a generic 500.
- Request header/host input is copied into a frozen resolver snapshot and never appears in default
  error messages.
- Tenant lifecycle remains active until response finish, response close, request abort, or synchronous
  dispatch failure, with idempotent listener removal.
- Express 5 promise rejection handling forwards asynchronous resolver/lifecycle failures; Express 4 is
  outside the tested compatibility boundary.

## Implemented Next.js Integration Controls

- Route Handlers and Server Actions resolve only in Node through one application-owned manager and
  resolver; only a `resolved` outcome enters tenant context.
- Server Action arguments never select tenant or central scope; identity comes from Next request
  headers and is copied into a frozen resolver snapshot.
- The Edge-only export imports no context, registry, adapter, or database code. Its reserved hint is
  untrusted and is revalidated through the Node resolver and tenant store.
- Missing/invalid identities use sanitized 400 errors; unknown and suspended identities share a
  generic 404; ambiguous registry data maps to a generic 500.
- Supported lifecycle ends at handler/action promise settlement. Tenant database work in streamed
  response callbacks is explicitly unsupported.
- Applications must use tenant-varying cache keys or `no-store`; the integration never patches Next
  cache APIs or treats cached identity as authorization.

## Implemented CLI Foundation Controls

- `init` is dry-run by default and creates fixed new files only with `--apply`; no overwrite mode exists.
- Roots are canonicalized and every write/test path is revalidated for containment, symlinks,
  duplicates, conflicts, and races before exclusive commit.
- Generated writes stage inside the project, commit through non-overwriting hard links, and roll back
  files/directories created by a failed operation.
- Doctor reads metadata/text only, skips `.env`, VCS/dependencies/build/generated trees, symlinks, and
  large files, and never imports project code or connects to a database/network.
- Human, JSON, error, and leak-test output redact URL credentials and secret-like assignments.
- `test:leak` runs only an explicit contained JavaScript file through absolute Node with `shell: false`;
  its environment is allowlisted and time/output are bounded. The trusted file is not sandboxed.
