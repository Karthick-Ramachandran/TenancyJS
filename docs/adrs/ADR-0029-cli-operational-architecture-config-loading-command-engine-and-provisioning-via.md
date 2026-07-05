# ADR-0029: CLI Operational Architecture: Config Loading, Command Engine, And Provisioning Via Host Hooks

## Status

Accepted

## Supersedes

- ADR-0027-cli-operational-architecture-runtime-config-loading-and-command-engine

## Context

ADR-0027 set the operational CLI's foundation (runtime config loading + command engine) but specified
that `migrate`/`provision` would have **the CLI shell out to each ORM's native tool** with a resolved
per-tenant connection. Building toward that surfaced a problem that cuts against the project's core
value (honesty — only claim what is tested): if the CLI itself runs `prisma migrate` / `knex migrate` /
etc., it must *know* each ORM's invocation, so it can only ever support the specific ORMs we have wired
and tested — and every new stack (NestJS + an unverified ORM, Mongoose, TypeORM edge cases) risks the
CLI silently *appearing* to support something it has never tested. The owner was explicit: do not repeat
a past over-claim; give users a proper, honest use case with limitations stated up front.

Phases 1–4 + T7 of F-012 (config loader, command engine, `tenant check/list/show/create/suspend/
activate`, `run <script>`) already shipped gate-green under ADR-0027; this ADR carries those forward and
revises only the provisioning/migration model plus adds a capability-honesty rule.

## Decision

1. **Config loading + command engine — unchanged from ADR-0027.** Node 24 native TS type-stripping loads
   `tenancy.config.ts` (zero runtime deps); the host exports one `defineTenancyRuntime({ manager, store?,
   adapters?, provisioner? })` contract; `withRuntime` loads → runs → disposes, preserving the command's
   error over any disposal error. The bring-your-own hardened `TenantStore` (ADR-0028) is unchanged.
2. **Provisioning/migration delegates to host-provided hooks — the CLI never invokes an ORM itself.**
   The runtime's `provisioner` supplies optional `provision(tenant)`, `deprovision(tenant)`,
   `migrate(tenant)` functions; the host wraps its own ORM/tooling inside them. The CLI *orchestrates*
   (resolve the tenant(s) and placement from the store, run per-tenant, order, report fail-closed) but
   is ORM-agnostic. A command whose hook is absent fails with a clear "your runtime does not provide a
   `<hook>` hook" message — never a silent no-op. This is "delegated, never reimplemented" taken to its
   honest conclusion: the CLI cannot over-claim ORM support because it never touches the ORM.
3. **Capability-honesty is surfaced, not assumed.** A tested-support matrix records which
   (adapter, strategy) combinations are adversarially proven. `tenant check` (and provisioning commands)
   report untested combinations as explicit warnings — e.g. "This adapter/strategy is not in the tested
   matrix; use at your own risk" — so users see limitations before relying on them, matching the init
   capability banner.

## Alternatives Considered

- **CLI spawns native ORM CLIs directly (ADR-0027's original).** Rejected: forces per-ORM knowledge into
  the CLI, so it can only support tested ORMs and risks silently appearing to support untested stacks —
  exactly the over-claim the owner wants to avoid; also hard to test without real ORM binaries.
- **CLI reimplements migrations.** Rejected outright (project principle).
- **No provisioning in 1.0.** Rejected: schema/database-per-tenant need lifecycle commands to be usable;
  delegating to hooks makes them shippable and honest now.

## Consequences

- Improves: provisioning works for *any* stack the host can script, with zero over-claim; the CLI stays
  ORM-agnostic and testable via injected hooks; users get explicit limitations for untested combos.
- Worsens/risks: the host writes small provisioner hooks (a few lines wrapping their migrator) — but that
  is the honest boundary, and it is where per-tenant placement is applied. Untested-combo warnings must
  be kept in sync with what has actually been adversarially proven.

## Related Documents

- PRD: docs/40-features/F-012-cli-operational/PRD.md
- Architecture: docs/10-architecture/ARCHITECTURE.md
- Security: docs/20-security/SECURITY_MODEL.md
- Feature: docs/40-features/F-012-cli-operational
