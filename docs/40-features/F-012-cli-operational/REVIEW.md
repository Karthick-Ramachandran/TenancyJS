# Review: Cli Operational

## Status

Reviewed (independent adversarial pass) — blocking findings fixed and re-gated.

## Findings

Independent review flagged 6 issues; all blocking/security ones fixed on branch.

- **HIGH — `--json` leaked bare secret fields.** The `SECRET_ASSIGNMENT` regex expected `key=value`
  but serialised JSON is `"key": "value"` (quote between key and colon), so `password`/`token`/`apiKey`
  fields printed in cleartext under `--json`. **Fixed:** added `redactData()` — deep, key-name-aware
  redaction of the object graph BEFORE `JSON.stringify`; all `--json` paths and the human record
  formatter now go through it. Tests use bare-secret fixtures (`store-secrets.config.mjs`).
- **HIGH — provision/migrate `--json` bypassed redaction entirely** (used `formatJson`, not the
  redacting formatter), leaking host-hook error messages incl. connection strings. **Fixed:** every
  operational `--json` path now uses `formatRedactedJson`; test asserts a failing hook's secret is
  redacted.
- **MEDIUM — CLI trusted the forgeable brand and never re-hardened the store**, so a hand-built
  runtime supplied an unhardened store and the ADR-0028 wrong-tenant guarantee wasn't enforced at the
  CLI boundary. **Fixed:** `hardenLoadedStore()` in the loader re-hardens every loaded store (id-match
  on find/suspend/activate, uniqueness on list, echo on create); adversarial `store-evil.config.mjs`
  proves a wrong-tenant `find` and duplicate `list` are rejected — including on destructive
  `deprovision`.
- **MEDIUM — security tests passed vacuously** (all secrets were URL-cred form the working regex
  caught). **Fixed:** added bare-secret + wrong-tenant + `--json`-error fixtures/tests and a direct
  `redactData` unit test.
- **LOW — parser silently ignored stray positionals / `--all` on tenant subcommands.** **Fixed:** rejects
  extra positionals on tenant (>2) and run (>1); `--all` restricted to `tenant migrate` only.
- **LOW — `run <script>` top-level scoping relies on ESM import caching.** Accepted: the CLI runs a
  fresh process per invocation, so top-level runs once inside scope as intended; documented.

Verdict after fixes: the two secret-leak paths and the store-hardening gap are closed and covered by
non-vacuous tests; full gate green with Postgres/MySQL/Mongo.
