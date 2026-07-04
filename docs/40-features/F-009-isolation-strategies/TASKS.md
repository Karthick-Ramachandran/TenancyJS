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

## T4: Database-enforced (opt-in per-tenant role)

Status: Todo

Scope:
- Per-tenant role + `USAGE`-only grants; tenant scope `SET ROLE`s; DB blocks cross-schema. Provisioning
  role/grant lifecycle.

## T5: Provisioning

Status: Todo

Scope:
- `tenancy provision`/`deprovision`: `CREATE SCHEMA` + per-schema migrate (+ per-tenant role in
  DB-enforced mode).

Do Not:
- Flip any `schemaPerTenant` capability to `"supported"` before its two-tenant adversarial test passes.
- Set `search_path` outside a transaction (must be transaction-local so it reverts).
