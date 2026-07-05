# Architecture Impact: Cli Operational

## Affected Modules

- `@tenancyjs/core` — new `defineTenancyRuntime()` runtime contract, `TenantStore<TTenant>` interface,
  and `assertStoreTenant` hardening wrappers.
- `@tenancyjs/cli` — new runtime config loader, command engine, and operational commands (registry,
  run, migrate, provision); existing static commands (`init`, `doctor`, `test:leak`) unchanged except
  `doctor` gains a runtime/store round-trip check.
- Adapters — expose the placement/migration hooks the CLI delegates to (no isolation-logic change).

## ADR Impact

Introduced and accepted **ADR-0027** (CLI operational architecture: runtime config loading + command
engine) and **ADR-0028** (tenant store contract). No existing ADR is superseded.

## Security Impact

Yes — new surface. Operational commands execute host code and open real DB connections (scoped to those
commands; static commands stay connection-free). Mitigations: secrets redacted in all output; native
tools spawned with argument arrays (no shell strings); store output validated (fail-closed on mismatch);
runtime disposed on every path with no unscoped-connection fallback. No new runtime dependency (Node 24
native TS type-stripping loads the config).
