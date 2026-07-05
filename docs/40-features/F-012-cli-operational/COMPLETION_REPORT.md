# Completion Report: Cli Operational

## Status

Implementation done on branch `feature/cli-operational` (6 increments, each landed gate-green);
**independent review pending** (see REVIEW.md) before PR/merge to `main`. Governed by ADR-0029 (config
loading, command engine, provisioning via host hooks) and ADR-0028 (tenant store contract).

## Files Changed

- `tenancyjs-core`: `defineTenancyRuntime()`/`TenancyRuntime`/`TenancyProvisioner` (runtime.ts),
  `TenantStore` + `hardenTenantStore`/`requireStoreMethod` (tenant-store.ts), store/runtime error
  classes (errors.ts), index exports.
- `tenancyjs-cli`: `runtime-loader.ts` (Node-24 type-stripped config load + brand validation),
  `runtime-command.ts` (`withRuntime` engine), `commands/{tenant,check,run,provision}.ts`, output
  formatters, `cli.ts` routing + flag/positional parser (`--config/--set/--tenant/--central/--all`),
  index exports.
- Docs: F-012 (PRD/ACCEPTANCE/PLAN/TASKS/TEST_PLAN/ARCHITECTURE_IMPACT), ADR-0028, ADR-0029.

## Commands Delivered

- `tenant check` — read-only runtime/store health probe + per-adapter capability honesty (warns on
  any adapter/strategy not tested-supported, read from the adapter's own self-report).
- `tenant list | show <id>` — read the bring-your-own store.
- `tenant create [<id>] [--set k=v …] | suspend <id> | activate <id>` — write the store.
- `tenant provision <id> | deprovision <id> | migrate (<id> | --all)` — delegate to host provisioner
  hooks; CLI never invokes an ORM.
- `run <script> (--tenant <id> | --central)` — execute a host script inside a resolved scope.
- All: redacted human + `--json`, fail-closed, dispose-always via `withRuntime`.

## Tests Run

- Full gate (`pnpm check`) green with Postgres + MySQL + MongoDB on every increment. Final:
  statements 96%, branches 91.52%, functions 97.42%, lines 96.28% (thresholds 95/90/95/95).
- `persist doctor`: PASSED.

## Results

- The read → write → run → provision → health surface works end-to-end against any bring-your-own
  store/provisioner, with no runtime dependency (Node 24 native TS type-stripping loads the config).
- Honesty is structural: the store is hardened (wrong-tenant returns rejected), and `tenant check`
  surfaces untested adapter/strategy combos rather than pretending support.

## Remaining Risks

- P6 polish is largely satisfied per-phase; a dedicated user-facing CLI/`defineTenancyRuntime` guide is
  best written alongside npm publish (README stays intentionally minimal until then).
- `migrate:central` (central-scope migrations) not implemented — host can use `run <script> --central`.
- Capability-honesty warnings depend on adapters keeping their self-reports accurate (they already do,
  by the "flip to supported only after adversarial test" rule).
