# Plan: Isolation Strategies

## Approach

**Structure: a dialect-organized shared strategy engine, not per-adapter reimplementation.** The strategy
mechanism is mostly a database concern, not an ORM concern, so it is factored as:

- `TenantStrategyEngine` — a dialect-neutral contract (`applyContext`, `provision`, `deprovision`,
  `validate`).
- **Per-dialect implementations** written once and shared across every ORM on that engine:
  `postgres` (RLS / `search_path` / separate DB), `mysql` (query-scoping / separate DB — schema-per-tenant
  ≡ database-per-tenant, since MySQL schema == database), and later `mongo`.
- **Thin per-ORM bindings** (Knex, Lucid, Prisma): run the engine's operations on the ORM's
  transaction/connection and address tables per the strategy. Prisma stays special (no native
  `search_path`).

This keeps the isolation-critical SQL in one place per dialect, adversarially tested once, and is not
Postgres-locked — MySQL/Mongo are additional dialect modules. Refines ADR-0017/ADR-0018 (same mechanism,
factored as a shared engine).

Deliver in increments; each independently tested and gate-green.

1. **Foundation (done):** `schemaPerTenant` in `TenancyStrategy` + capability matrix; config validates all
   three; adapters declare `schemaPerTenant: "unsupported"`. ADR-0017. No behavior change.
2. **Done — strategy-engine contract + Postgres dialect (schema-per-tenant)** + thin **Knex binding**:
   transaction-local `search_path`, unqualified addressing, schema-per-tenant validation +
   real-Postgres two-tenant adversarial test. Flip Knex capability only then. Provisioning remains T5.
3. **Done — thin Lucid binding** reusing the same Postgres dialect + adversarial test.
4. **Done — database-per-tenant**: bounded shared resource cache under ADR-0021 plus per-tenant
   connection/client routing and adversarial tests across the supported adapters.
5. **Done — database-enforced schema-per-tenant** (opt-in per-tenant role, ADR-0018) and **Prisma
   per-schema client cache** using the Prisma 7 driver schema option (ADR-0030).
6. **Done — provisioning orchestration** through host-owned provisioner hooks under F-012/ADR-0029;
   native ORM/DDL tooling remains outside TenancyJS.

## Boundaries

- Every supported PostgreSQL adapter has strategy-specific real-database evidence; MySQL has no distinct
  schema strategy and MongoDB rejects it.
- Fail closed: an adapter must reject any strategy it does not declare `"supported"`.
- Reuse the existing forced-RLS/query-scoping row-level machinery; do not regress it.
- Each new strategy needs real two-tenant adversarial evidence before its capability flips to
  `"supported"`.
- Do not contradict accepted ADRs; new decisions get new ADRs.
