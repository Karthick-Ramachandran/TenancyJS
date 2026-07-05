# Acceptance Criteria: Cli Operational

## Criteria

- A `defineTenancyRuntime({ manager, store?, adapters?, provisioning? })` helper exists in core and is
  the sole contract the CLI reads; the CLI resolves + imports `tenancy.config.ts` (default) or
  `--config <path>` and fails with a clear, redacted error when the module is missing/malformed.
- `tenant list | show | create | suspend | activate` operate through the host `TenantStore`; each
  degrades with a clear "not supported by your store" error when the store omits that method (never a
  crash).
- The store contract is enforced: `find(id)` returning a tenant whose `id !== id` throws; `list()` with
  duplicate ids throws; `create` echoes the persisted id. `doctor` round-trips create→find when a store
  is configured.
- `run <script>` executes the host script inside the resolved tenant (or central) scope and exits
  non-zero on failure without leaking an unscoped connection.
- `migrate` / `provision` delegate to native ORM tooling with per-tenant placement resolved from the
  store record; spawned as argument arrays (never shell strings).
- Every operational command supports `--json`, redacts secrets, and disposes adapters/cache so the
  process exits cleanly.
- Full gate green (`pnpm check`) with coverage thresholds met; `persist doctor` clean.

## Out Of Scope

- Provisioning Prisma schema-per-tenant (deferred).
- Any command outside the In-Scope list in the PRD.
