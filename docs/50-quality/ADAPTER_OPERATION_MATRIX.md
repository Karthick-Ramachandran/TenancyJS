# Adapter Operation Matrix

This matrix reports evidence, not theoretical ORM capability. `Supported` means the exact operation is
enforced by the secured client and covered by real-database conformance tests. `Rejected` means the
secured client fails before execution. `Not implemented` makes no compatibility claim.

## Current Adapter Status

| Adapter | ORM/data layer evidence | Row-level status | Database-per-tenant status | Detailed matrix |
|---|---|---|---|---|
| Prisma | Prisma 7.8 + PostgreSQL 17 | Experimental; supported top-level matrix | Not implemented | `packages/adapter-prisma/README.md` |
| Sequelize | Not implemented | Not implemented | Not implemented | Required when implemented |
| Knex | Knex 3.3 + PostgreSQL 17 | Experimental; supported protected-client matrix | Not implemented | `packages/adapter-knex/README.md` |
| Lucid | Not implemented | Not implemented | Not implemented | Required when implemented |

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
| raw SQL/TypedSQL entry points | Rejected | arbitrary SQL cannot be generically tenant-enforced |
| nested relation reads/writes | Rejected | Prisma query extensions lack reliable nested hooks |
| fluent relation traversal | Rejected | configured relation selection detected before execution |
| unknown/unclassified models | Rejected | exhaustive classification required |
| unknown operations | Rejected | no best-effort delegation |
| database-per-tenant | Unsupported | owned by later T-11 capability work |

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
| OR/clear/join/union/CTE/subquery/stream/truncate | Rejected | mutable composition is not yet proven safe |
| unclassified tables/unknown operations | Rejected | exhaustive classification and runtime proxy rejection |
| non-PostgreSQL/database-per-tenant | Unsupported | requires a separate enforcement capability and evidence |
