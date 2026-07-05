# Tasks: Isolation Strategies

## T1: Foundation (strategy model)

Status: Done

Scope:
- Add `schemaPerTenant` to `TenancyStrategy` + `TenancyAdapterCapabilities`; validate all three
  strategies; adapters declare `schemaPerTenant: "unsupported"`. ADR-0017. No behavior change.

Acceptance:
- Gate green; adapters fail closed on undeclared strategies. (Merged, PR #13.)

## T2: Knex schema-per-tenant, adapter-enforced (ADR-0018)

Status: Done

Scope:
- `config`: schema-per-tenant mode + `schema(tenant) => string` resolver (validated identifier).
- `adapter`: set transaction-local `search_path` in the existing context step; strategy reflects config;
  schema-per-tenant validation replaces RLS validation.
- `query`: unqualified addressing (search_path routes), no `tenant_id` filter, raw/cross-schema rejected.
- Flip Knex `schemaPerTenant` to `"supported"` ONLY after the adversarial test passes.

Acceptance:
- Two-tenant adversarial test on real Postgres: tenant A's protected client cannot read/write tenant B's
  schema; central scope reaches only central/public; raw + cross-schema-qualified access rejected.

Tests:
- Real-PG two-schema adversarial isolation; config validation; capability flip.

Evidence:
- Shared engine unit/security suite and Knex schema configuration tests pass.
- Three Knex schema-per-tenant PostgreSQL 17 tests pass, including concurrent read/write isolation,
  mutation denial, central placement, rollback, raw/qualified rejection, and pool cleanup.

## T3: Lucid schema-per-tenant, adapter-enforced

Status: Done

Scope:
- Same shared `search_path` mechanism on Lucid model transactions; hook-skipping paths fail closed.

Evidence:
- Four Lucid schema-per-tenant PostgreSQL 17 tests pass alongside the four row-level tests, including
  relationships, create/read isolation, cross-tenant mutation denial, central rejection, rollback,
  hook-bypass rejection, and pool cleanup.

## T4: Database-per-tenant shared resource cache

Status: Done

Scope:
- Bounded, single-flight, reference-counted LRU resource cache in adapter-shared; tenant/placement
  collision rejection; deterministic shutdown and sanitized failures. ADR-0021.

Evidence:
- Ten focused cache tests cover configuration, mapping collision, single-flight creation, active
  capacity, idle LRU, callback cleanup, sanitized create/destroy failures, retention/retry, and shutdown.
- Full no-database workspace gate passes 322 tests with coverage and package-consumer checks.

## T5: Knex database-per-tenant binding

Status: Done

Scope:
- Host placement/client factory, lazy connectivity failure, protected client reuse, and real
  two-database isolation/cache lifecycle evidence. The host owns key-to-database correctness; flip
  Knex capability only after adversarial evidence.

Evidence:
- Thin binding over the shared cache, bounded lifecycle, fail-closed creation, and real PostgreSQL
  two-database tests with colliding primary keys.

## T6: Lucid and Prisma database-per-tenant bindings

Status: Done

Scope:
- Thin Lucid and Prisma bindings over the shared cache with separate real-database evidence.

Evidence:
- Lucid and Prisma real PostgreSQL two-database tests use the same row ID in both tenants and prove a
  tenant-A update leaves tenant B unchanged. The Prisma public router rejects placement collisions.

## T7: Database-enforced schema mode (opt-in per-tenant role)

Status: Done

Scope:
- Per-tenant role + `USAGE`-only grants; tenant scope `SET ROLE`s; database blocks cross-schema.

Evidence:
- Real PostgreSQL role test proves cross-schema raw access is denied and transaction-local role plus
  `search_path` revert on the same pooled connection before reuse.

## T8: Provisioning

Status: Done through F-012 / ADR-0029

Scope:
- `tenant provision`/`deprovision`/`migrate` delegates to host provisioner hooks after resolving the
  hardened tenant record and placement. The host invokes its native ORM/DDL tooling; TenancyJS does not
  reimplement schema/database creation or migration.

Evidence:
- CLI unit/binary tests cover explicit-id provisioning/deprovisioning, migrate-all partial failure,
  wrong-tenant store rejection, secret redaction, and missing hook/store failures.
- F-012 and ADR-0029 supersede the earlier direct-DDL design.

## T9: Isolation review hardening

Status: Done

Scope:
- Reject tenant/schema collisions for the shared strategy-engine lifetime.
- Report lazy tenant-database verification honestly from Knex/Lucid `validate()`.
- Strengthen separate-database tests with colliding row IDs and exercise collision rejection through
  the Prisma router.
- Document the callback-only lifetime of a routed Prisma client.

Do Not:
- Flip any `schemaPerTenant` capability to `"supported"` before its two-tenant adversarial test passes.
- Set `search_path` outside a transaction (must be transaction-local so it reverts).

## T10: Cross-adapter strategy completion

Status: Done

Scope:
- Prisma/PostgreSQL schema-bound driver clients; TypeORM/Sequelize PostgreSQL schema and database
  bindings; Prisma/MySQL and Mongoose/MongoDB database routing.

Evidence:
- Real two-tenant tests use colliding IDs in two PostgreSQL schemas, two PostgreSQL databases, two MySQL
  databases, and two MongoDB databases. Tenant-A mutations leave tenant B unchanged.
