# Adapter Operation Matrix

This matrix reports evidence, not theoretical ORM capability. `Supported` means the exact operation is
enforced by the secured client and covered by real-database conformance tests. `Rejected` means the
secured client fails before execution. `Not implemented` makes no compatibility claim.

## Current Adapter Status

| Adapter | ORM/data layer evidence | Row-level status | Schema-per-tenant status | Database-per-tenant status | Detailed matrix |
| --- | --- | --- | --- | --- | --- |
| Prisma | Prisma 7.8 + PostgreSQL/MySQL | Supported; extension path adapter-enforced, `createPrismaRowLevelTenancy` forced-RLS database-enforced on PostgreSQL | PostgreSQL supported; driver-routed | PostgreSQL/MySQL supported | `packages/adapter-prisma/README.md` |
| Knex | Knex 3.3 + PostgreSQL 17 | Supported; forced-RLS database-enforced | Supported; adapter-enforced | Supported | `packages/adapter-knex/README.md` |
| Lucid | Lucid 22.4 + PostgreSQL 17 | Supported normal-model matrix; forced-RLS database-enforced | Supported; adapter-enforced | Supported | `packages/adapter-lucid/README.md` |
| TypeORM | TypeORM 1 + PostgreSQL/MySQL | PostgreSQL database-enforced; MySQL adapter-enforced/experimental | PostgreSQL supported | PostgreSQL/MySQL supported | `packages/adapter-typeorm/README.md` |
| Sequelize | Sequelize 6.37 + PostgreSQL/MySQL | PostgreSQL database-enforced; MySQL adapter-enforced/experimental | PostgreSQL supported | PostgreSQL/MySQL supported | `packages/adapter-sequelize/README.md` |
| Drizzle | Drizzle 0.45 + PostgreSQL/MySQL | PostgreSQL database-enforced; MySQL adapter-enforced/experimental | PostgreSQL supported | PostgreSQL/MySQL supported | `packages/adapter-drizzle/README.md` |
| Mongoose | Mongoose 9 + MongoDB replica set | Supported; adapter-enforced | Not applicable | Supported | `packages/adapter-mongoose/README.md` |

## Prisma 7.8/PostgreSQL 17

| Operation family | State | Enforcement/evidence |
|---|---|---|
| unique/first/many reads | Supported | tenant predicate appended; unique selector preserved at top level |
| count/aggregate/groupBy | Supported | tenant predicate appended |
| create/createMany/returning | Supported | tenant discriminator injected/validated |
| update/updateMany/returning | Supported | tenant predicate appended; discriminator mutation rejected |
| delete/deleteMany | Supported | tenant predicate appended |
| upsert | Supported | tenant-scoped selector and validated create/update branches |
| batch/interactive transactions | Supported | extension callback retains transaction and context; rollback tested |
| explicit central context | Supported | lexical administrative bypass for supported operations |
| allowlisted central models | Supported | pass-through after operation/relation validation |
| raw SQL/TypedSQL entry points | Rejected on the extension path | arbitrary SQL cannot be generically tenant-enforced by the facade |
| RLS-backed row-level (`createPrismaRowLevelTenancy`) | Supported on PostgreSQL | run-scoped interactive transaction that `SET LOCAL`s the tenant GUC; model, nested, and raw are RLS-enforced, and a raw cross-tenant insert is rejected by `WITH CHECK`. Requires a driver adapter (`@prisma/adapter-pg`) and forced RLS |
| nested relation reads/writes | Rejected | Prisma query extensions lack reliable nested hooks |
| fluent relation traversal | Rejected | configured relation selection detected before execution |
| unknown/unclassified models | Rejected | exhaustive classification required |
| unknown operations | Rejected | no best-effort delegation |
| database-per-tenant | Supported | bounded cache-routed clients; real PostgreSQL/MySQL separate-database evidence |

The guarantee conditions and expansion rules are defined in
`docs/20-security/ADAPTER_SECURITY_CONTRACT.md`.

## Knex 3.3/PostgreSQL 17

| Operation family | State | Enforcement/evidence |
|---|---|---|
| select/first/count/basic aggregates | Supported | protected AND predicates plus forced RLS |
| insert/bulk insert | Supported | discriminator injected/validated plus RLS `WITH CHECK` |
| update/delete | Supported | tenant predicate plus forced RLS; discriminator update rejected |
| managed transactions/savepoints | Supported | transaction-local context, rollback and pooled cleanup tested |
| explicit central context/central tables | Supported | adapter-owned central flag and explicit allowlist |
| raw/schema/migration/client/connection | Rejected | outside callback-scoped protected-client boundary |
| `unrestricted()` raw SQL (forced RLS, tenant mode) | Supported | full query freedom (raw SQL, joins, nested) runs under the non-`BYPASSRLS` role and is bound to the current tenant by the validated RLS policy; still refused in central mode |
| OR/clear/join/union/CTE/subquery/stream/truncate | Rejected | mutable composition is not yet proven safe |
| unclassified tables/unknown operations | Rejected | exhaustive classification and runtime proxy rejection |
| non-PostgreSQL | Unsupported | PostgreSQL-only adapter |
| schema-per-tenant reads/writes | Supported | unqualified protected tables + validated transaction-local `search_path`; adapter-enforced |
| schema qualified/cross-placement tables | Rejected | configuration and protected table classification reject qualification |

## Lucid 22.4/PostgreSQL 17

| Operation family | State | Enforcement/evidence |
|---|---|---|
| find/fetch/paginate/aggregate | Supported | model hook attaches the managed transaction; row mode adds the predicate/RLS, schema mode uses local `search_path` |
| create/save/delete | Supported | transaction attachment; row mode enforces discriminator, schema mode routes unqualified tables |
| relationship preload | Supported | every registered related model receives the same fetch hook and transaction scope |
| managed transactions/savepoints | Supported | transaction-local context/search path and async-local transaction ownership |
| explicit central context | Supported (row-level) | adapter-owned central RLS setting; tenant models are rejected in schema-mode central context |
| `.pojo()`/quiet/bulk/direct builder | Rejected/fail-closed | hook-skipping paths receive no protected transaction and forced RLS must deny access |
| `unrestricted()` raw SQL (forced RLS, tenant mode) | Supported | full query freedom runs under the non-`BYPASSRLS` role and is bound to the current tenant by the validated RLS policy; still refused in central mode |
| unregistered models/base database service | Outside guarantee | application-retained Lucid surfaces bypass adapter hooks |
| non-PostgreSQL | Unsupported | PostgreSQL-only adapter |
| schema-per-tenant normal model operations | Supported | unqualified registered models + validated transaction-local `search_path`; adapter-enforced |
| schema-mode hook-skipping paths | Rejected/fail-closed | central tenant-table shadowing is prohibited, so unqualified bypasses cannot resolve a tenant table |

## TypeORM 1 / Sequelize 6 / Drizzle 0.45

| Operation family | State | Enforcement/evidence |
|---|---|---|
| scalar-equality reads/count | Supported | adapter-owned tenant predicate; PostgreSQL forced RLS adds a database backstop |
| create/createMany | Supported | discriminator injected or validated |
| update/delete | Supported | tenant predicate composed; discriminator moves rejected |
| managed transactions | Supported | adapter-owned transaction and rollback; PostgreSQL context is transaction-local |
| schema-per-tenant | PostgreSQL supported | unqualified tables + shared validated `search_path`; optional role hardening |
| database-per-tenant | PostgreSQL/MySQL supported | bounded cache-routed resources with colliding-ID separate-database tests |
| MySQL row-level | Supported, experimental | protected facade only; no database RLS backstop |
| `unrestricted()` raw SQL (PostgreSQL forced RLS, tenant mode) | Supported | full query freedom runs under the non-`BYPASSRLS` role and is bound to the current tenant by the validated RLS policy; still refused in central mode, and unavailable on MySQL row-level (no RLS) |
| raw/native client/query builder/relations/joins | Rejected or absent | outside callback-scoped protected facade |
| unknown tables/models/entities | Rejected | exhaustive registration required |
| MySQL schema-per-tenant | Not applicable | MySQL schema and database are the same namespace |

Drizzle additionally rejects native SQL expressions and relational query objects. Full public usage
and cleanup contracts are in each adapter README.
