# ADR-0027: CLI Operational Architecture: Runtime Config Loading And Command Engine

## Status

Accepted — superseded by ADR-0029-cli-operational-architecture-config-loading-command-engine-and-provisioning-via

## Context

The F-005/F-008 CLI is static: `init` scaffolds files, `doctor` inspects source, `test:leak` runs one
explicit file. None of them load or execute the host's runtime wiring. The mature 1.0 CLI (F-012) adds
operational commands — `list`/`create` (tenant registry), `run` (execute inside a tenant scope),
`migrate`/`provision` — that must reach the host's live `TenancyManager`, `TenantStore`, adapters, and
database connections. That requires loading the host's `tenancy.config.ts` at runtime, which is a new
capability and a new trust/security surface.

## Decision

1. **Runtime config loading via Node 24 native type-stripping.** The CLI resolves and dynamically
   `import()`s the host's config module (default `tenancy.config.ts`, overridable with `--config`).
   Node 24 strips TypeScript types natively, so **no transpiler dependency** (tsx/jiti/ts-node) is
   added — the CLI stays zero-runtime-dependency. The config module exports a runtime object (see below).
2. **A `defineTenancyRuntime()` export contract.** Operational commands need one object, not scattered
   globals. The host's config default-exports (or names) a runtime built by a core helper:
   `defineTenancyRuntime({ manager, store?, adapters?, provisioning? })`. The CLI reads only this
   contract; it never reaches into framework internals.
3. **Command engine.** A small dispatcher: parse args → load runtime (for operational commands only) →
   resolve target tenant(s) from flags/`store` → execute the command → format human/`--json` output →
   dispose (close adapters/cache). Setup/diagnostic commands (`init`/`doctor`/`test:leak`) do **not**
   load the runtime (unchanged, safe on a project that cannot yet connect).
4. **ORM migration/provisioning is delegated, never reimplemented** (ADR-later): `migrate`/`provision`
   shell out to each ORM's native tool with the resolved per-tenant connection/schema.
5. **Security posture.** Loading the config executes host code and opens real DB connections — expected
   for operational commands and scoped to them. All output is redacted (reuse `redactText`); native
   tools are spawned with argument arrays, never shell strings; failures fail closed and never fall back
   to an unscoped connection.

## Alternatives Considered

- **Add a transpiler (tsx/jiti) to load TS config.** Rejected: Node 24 strips types natively; adding a
  dep breaks the CLI's zero-runtime-dependency hygiene.
- **Require a pre-compiled JS config.** Rejected: poor DX; every operational command would need a build
  step first.
- **Read scattered exports (manager here, store there).** Rejected: brittle; a single
  `defineTenancyRuntime` contract is explicit and versionable.
- **Reimplement migrations in the CLI.** Rejected (project principle): orchestrate ORM tools, don't
  replace them.

## Consequences

- Improves: the CLI can act on live tenants with no new dependency; one explicit runtime contract; clean
  separation between safe static commands and connect-required operational commands.
- Worsens/risks: operational commands execute host code + connect to databases (inherent); config-load
  failures must be reported clearly; disposal must close adapters/caches so the CLI exits. Built in phases
  (config loader + registry first; delegation later), each gate-green.

## Related Documents

- PRD: docs/40-features/F-012-cli-operational/PRD.md
- Architecture: docs/10-architecture/ARCHITECTURE.md
- Security: docs/20-security/SECURITY_MODEL.md
- Feature: docs/40-features/F-012-cli-operational
