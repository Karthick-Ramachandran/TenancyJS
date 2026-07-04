# Tasks: Isolation Strategies

## T1: Foundation (strategy model)

Status: Done

Scope:
- Add `schemaPerTenant` to `TenancyStrategy` + `TenancyAdapterCapabilities`; validate all three
  strategies; adapters declare `schemaPerTenant: "unsupported"`. ADR-0017. No behavior change.

Acceptance:
- Gate green; adapters fail closed on undeclared strategies. (Merged, PR #13.)

## T2: Knex schema-per-tenant, adapter-enforced (ADR-0018)

Status: Todo

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

## T3: Lucid schema-per-tenant, adapter-enforced

Status: Todo

Scope:
- Same mechanism on Lucid (searchPath / named connection); adversarial test.

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
