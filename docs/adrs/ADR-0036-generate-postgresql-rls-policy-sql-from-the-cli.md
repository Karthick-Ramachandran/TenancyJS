# ADR-0036: Generate PostgreSQL RLS Policy SQL From The CLI

## Status

Accepted

## Context

On PostgreSQL, row-level isolation is only database-enforced when the operator has stood up a specific,
exact contract: a runtime role that is **non-owner, non-superuser, and non-`BYPASSRLS`**; `ENABLE` +
**`FORCE ROW LEVEL SECURITY`** on every tenant table; and a `<table>_tenant_isolation` policy whose
`USING` **and** `WITH CHECK` expressions both read `tenancyjs.tenant_id` and `tenancyjs.is_central`.
`validatePostgresRlsPolicies` (in `adapter-shared`) checks all of this at startup and refuses to run
until it passes.

The library validates that contract but never emits it. Today the DDL exists only as prose — a comment
in the scaffolded migration (`packages/cli/src/templates.ts`) and guidance in the AI-context file
(`packages/cli/src/ai-context.ts`). Operators hand-write the role, the `FORCE` statements, and the
policy predicates. This is the single steepest onboarding step, and it is error-prone in a way that
matters: forgetting `FORCE`, omitting `WITH CHECK`, or getting the policy predicate subtly wrong either
fails startup validation (best case, loud) or — if someone also relaxes validation — silently weakens
isolation (worst case). External review flagged this as a top adoption blocker.

`SECURITY_MODEL.md` states that "TenancyJS never constructs DDL or invokes ORM migration CLIs itself":
provisioning and migration are delegated to explicit host hooks. Any generator must respect that stance.

## Decision

Add `tenancy policy` — a CLI command that **emits review-ready RLS DDL to stdout or a file and executes
nothing.**

- **Generate, never execute.** The command prints SQL for the operator to review and run through their
  own migration tool. It opens no database connection, invokes no ORM, and runs no DDL. This keeps the
  boundary in `SECURITY_MODEL.md` intact: generating a reviewable template is scaffolding (the CLI
  already scaffolds migration comments); *executing* DDL remains delegated to host hooks. The
  distinction — codegen vs. execution — is the whole reconciliation.
- **Inputs from flags, deterministic output.** `tenancy policy --table <t> [--table <t> ...] --role
  <runtime-role> [--tenant-column <col>] [--out <file>] [--json]`. No config load and no I/O beyond
  writing the requested file, so output is deterministic and diffable.
- **Output matches the validator exactly.** For each table the command emits `ALTER TABLE <t> ENABLE
  ROW LEVEL SECURITY; ALTER TABLE <t> FORCE ROW LEVEL SECURITY;` and a `CREATE POLICY
  <t>_tenant_isolation` whose `USING` and `WITH CHECK` both read `current_setting('tenancyjs.tenant_id',
  true)` and `current_setting('tenancyjs.is_central', true)`, plus `REVOKE ALL ... FROM PUBLIC` /
  `GRANT`s to the runtime role, and a commented, non-destructive role-creation stanza the operator
  fills in. The default policy name follows the existing `<table>_tenant_isolation` convention.
- **Generator and validator stay in lockstep.** A test generates the policy and asserts the output
  satisfies the same substrings `validatePostgresRlsPolicies` requires (both GUCs in both `USING` and
  `WITH CHECK`, `FORCE`), so the two can never drift.
- **Loud caveats in the output header.** The emitted SQL is commented: review before applying, column
  names must match the adapter's `tenantColumn`, and the runtime role must not own the tables.

## Alternatives Considered

- **Docs only (status quo).** Rejected — this is exactly the error-prone hand-work the review flagged.
- **Write ORM-specific migration files.** Rejected — a large, brittle surface across Knex/TypeORM/
  Sequelize/Drizzle/Lucid migrators, and it edges toward executing/owning migrations, which
  `SECURITY_MODEL.md` forbids.
- **Introspect a live database and emit a diff.** Rejected — requires a DB connection and privileges the
  CLI deliberately never takes; also non-deterministic.

## Consequences

- Onboarding drops from "read the contract and hand-write the role + `FORCE` + policy" to "run `tenancy
  policy`, review, apply with your migrator." No runtime behavior changes; the command is additive and
  connects to nothing.
- The generated SQL is a template, not a guarantee: the operator still applies it and still owns the
  runtime-role wiring. The output says so.
- Risk: generated SQL drifting from the validator's expectations — mitigated by the lockstep test above.
- Implemented in this change (additive CLI command + tests).

## Related Documents

- Architecture: docs/10-architecture/ARCHITECTURE.md
- Security: docs/20-security/SECURITY_MODEL.md, docs/20-security/ADAPTER_SECURITY_CONTRACT.md
- Related ADRs: ADR-0010 (Postgres RLS-backed Knex and Lucid), ADR-0019 (adapter-shared Postgres
  strategy engine), ADR-0033 (enforcement-tier-aware query freedom)
