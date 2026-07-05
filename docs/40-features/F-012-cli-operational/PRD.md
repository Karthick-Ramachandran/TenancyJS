# PRD: Cli Operational

## Purpose

The current CLI (F-005/F-008) is static — `init` scaffolds, `doctor` inspects source, `test:leak`
runs one file. None of them touch the host's live tenancy. To reach 1.0, operators need to *act on
tenants*: list/create/suspend/activate them, run a script inside a tenant scope, and migrate/provision
per-tenant storage — all through the host's own `tenancy.config.ts` runtime, fail-closed, with
secrets redacted. This feature makes the CLI operational without TenancyJS owning where tenants live
(bring-your-own `TenantStore`, per ADR-0028) and without reimplementing any ORM's migration tooling
(delegation to host hooks, per ADR-0029).

## In Scope

- **Runtime config loading** (ADR-0029): resolve + dynamically import `tenancy.config.ts` (Node 24
  native TS type-stripping, no transpiler dep) exposing a `defineTenancyRuntime()` contract.
- **Registry commands**: `tenant list | show | create | suspend | activate` against the host store.
- **`run <script>`**: execute a host script inside a resolved tenant (or central) scope.
- **`tenant provision` / `deprovision` / `migrate`**: delegate to the host runtime's provisioner hooks
  with per-tenant placement (ADR-0029); the CLI never invokes an ORM itself.
- **`provision` / `deprovision`**: create/drop a tenant's schema or database for schema/db-per-tenant.
- **Hardened store contract** (ADR-0028): validate the store's output (id must match, unique ids).
- **`doctor` extension**: verify a configured runtime loads and the store round-trips.
- **`--json` output + redaction** on every operational command; fail-closed disposal.

## Non-Goals

- Owning a tenant registry table/schema (bring-your-own store instead).
- Reimplementing ORM migrations (delegate to native tooling only).
- `tinker`/REPL, `impersonate`, `storage-link`, `maintenance up/down` — overkill for 1.0; deferred.
- Prisma schema-per-tenant provisioning (deferred per LESSONS — search_path does not route Prisma).
- Remote/hosted control plane, multi-node orchestration, web UI.
