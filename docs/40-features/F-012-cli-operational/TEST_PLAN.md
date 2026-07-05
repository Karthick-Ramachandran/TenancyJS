# Test Plan: Cli Operational

## Unit Tests

- Config loader: resolves default path + `--config`; imports a type-stripped `.ts` config; validates
  the `defineTenancyRuntime` shape; rejects missing/malformed config with a redacted message.
- `assertStoreTenant`: passes a matching tenant; throws on `id` mismatch, on `list()` duplicate ids,
  and on a `create` echo that changes the id.
- Command engine: dispatches to the right command; unknown command / missing store method yields a
  clear "not supported" error, not a crash; `--json` formatting; secret redaction in all output.
- `run`/`migrate` arg construction: native tools are invoked with argument arrays, never shell strings.

## Integration Tests

- `doctor` loads a stub runtime and round-trips a stub store (`create`→`find`).
- `tenant list | show | create | suspend | activate` against an in-memory store implementation.
- `run <script>` executes inside the resolved tenant scope and propagates the exit code.
- (Phase 5, DB-gated) `provision`/`migrate` route to the correct schema/database for a placement record.

## Security Tests

- Config-load failures and command errors never print unredacted connection strings/secrets.
- A store returning a mismatched tenant id is rejected before any command acts on it (fail-closed).
- Native migration/provision commands cannot be shell-injected (argument-array spawn asserted).
- On any failure the runtime disposes without falling back to an unscoped connection.
