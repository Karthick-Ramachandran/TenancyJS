# Tasks: Cli Operational

## T1: Runtime contract + config loader (Phase 1)

Status: Done

Scope:

- `defineTenancyRuntime()` + `TenantStore<TTenant>` + `hardenTenantStore`/`requireStoreMethod`
  hardening in core.
- CLI config loader (resolve + Node-24 type-stripped import + brand validation + redacted errors).

Acceptance:

- Config loads from default path and `--config`; malformed config fails closed with a redacted message.
- `find`/`list` output is validated (id match, uniqueness); violations throw.

Note: the `doctor` runtime-load + store round-trip check moved to T2, where the command engine and
store-access plumbing it depends on are built.

Tests:

- Unit: loader resolves/imports/validates; `assertStoreTenant` rejects mismatch + duplicates.
- Integration: `doctor` round-trips a stub store.

Do Not:

- Load the runtime for `init` or the static parts of `doctor`.

## T2: Registry read commands (Phase 2)

Status: Done

Scope: `tenant list`, `tenant show` — store-backed, human + `--json`, redacted, graceful degradation.
Includes the command engine (`withRuntime`: load runtime → dispatch → dispose, preserving the command
error over a disposal error).

Delivered: `withRuntime` engine, `tenant list`/`tenant show` commands, redacted human + `--json`
output, "no store"/"method unsupported"/"not found" fail-closed errors, `--config` flag.

Deferred to T7 (its own task): the `doctor` runtime-load + store round-trip check — the framework
`doctor` is Express-detection-specific, so a runtime/store health check is cleaner as a dedicated
`tenant check` command than retrofitted into it.

## T3: Registry write commands (Phase 3)

Status: Todo

Scope: `tenant create | suspend | activate` through the hardened contract.

## T4: run <script> (Phase 4)

Status: Todo

Scope: execute a host script inside a resolved tenant/central scope; exit codes; disposal.

## T5: migrate / provision (Phase 5)

Status: Todo

Scope: delegate to native ORM tooling with per-tenant placement; schema/db-per-tenant only.

## T6: Polish (Phase 6)

Status: Todo

Scope: unified help, error taxonomy, `--json` audit, disposal audit, docs.

## T7: tenant check — runtime + store health (split from T2)

Status: Todo

Scope: a `tenant check` command that loads the runtime and round-trips the store (`create`→`find`
consistency where supported, or a read-only `list`/`find` probe), reporting fail-closed. Kept separate
from the Express-specific framework `doctor`.
