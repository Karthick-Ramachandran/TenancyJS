# Security Model

## Status

Active and incremental. Core async context, fail-closed tenant access, explicit central scope,
lifecycle cleanup, tenant resolution, and Prisma row-level isolation are implemented and tested.
Other adapters, framework integrations, and CLI safety remain requirements for later tasks.

## Baseline Rules

- Never commit secrets or credentials, and never read or copy `.env` files into docs.
- Validate and authorize untrusted input at every trust boundary.
- Do not add network, telemetry, cloud, MCP runtime, or AI API behavior without explicit review.
- Adapter guarantees follow `docs/20-security/ADAPTER_SECURITY_CONTRACT.md`; unsupported operations
  fail instead of executing with best-effort isolation.

## Authentication And Authorization

TenancyJS resolves and propagates tenant identity; it does not authenticate end users. Framework
integrations accept only resolver outputs that the application has configured as trusted. Header,
host, path, or token-derived tenant identifiers are untrusted until validated and resolved against
the tenant registry. Tenant membership and application authorization remain the host application's
responsibility and must occur after tenant resolution.

Central-context and unsafe-bypass operations are privileged capabilities. They must be explicit APIs,
must never be selected from raw request input, and must not silently follow a resolver failure.

## Secrets And Configuration

Secrets are injected by the host application through environment variables or its secret manager.
Generated config and diagnostic output must never contain connection credentials. `tenancy doctor`
and `--json` output redact secret-valued fields. The CLI may update `.env.example` with variable
names and placeholders only; it never reads or copies `.env` values into generated files or logs.

## Sensitive Data

Tenant identifiers, domains, and database connection references are sensitive operational metadata.
The host application owns encryption at rest and transport security. TenancyJS avoids logging tenant
records or database URLs by default. Cross-tenant read, update, delete, aggregate, nested-write, and
transaction isolation are mandatory adapter conformance tests.

## Dependencies And Supply Chain

Runtime dependencies are kept minimal and packages use explicit peer ranges for framework and ORM
versions. Every supported peer range is exercised in CI before it is advertised. The CLI delegates
only to locally installed, allowlisted ORM executables using argument arrays rather than a shell.

## Trust Boundaries And Invariants

- Tenant context uses async-scope propagation; no mutable global tenant value is allowed.
- Tenant-aware operations without context fail closed in strict mode, which is the default.
- Unknown, malformed, suspended, or ambiguous tenants never become central context automatically.
- Central context and unsafe raw access are explicit and cannot be activated by user-controlled data.
- Cleanup runs in `finally`, including nested contexts and thrown/rejected handlers.
- Generated file paths are constrained to the target project; symlinks and traversal are rejected.
- Existing project files are not overwritten without a conflict report and explicit user approval.

## Implemented Core Controls

- `TenancyManager` exposes lexical tenant and central scopes only; there is no imperative global
  initialize/end pair.
- `getTenantOrFail` throws `TenantContextError` for missing and central scopes.
- Tenant records are shallow-cloned and frozen before lifecycle code observes them.
- Completed bootstrappers revert in reverse order, and cleanup continues after individual failures.
- `TenancyLifecycleError` preserves the primary failure and every cleanup failure.
- Core has no runtime dependencies, network, telemetry, storage, file-write, cloud, MCP, or AI behavior.

## Implemented Identification Controls

- Resolver precedence is explicit; present invalid/unknown high-priority identifiers never fall back.
- Header and ASCII host inputs reject ambiguity, controls, whitespace, schemes, paths, and userinfo.
- Custom resolver output is validated and stamped with the configured resolver ID before lookup.
- Registry duplicates and suspension return exhaustive non-secret outcomes rather than tenant records.
- Resolution establishes tenant identity only and never authenticates membership or selects central mode.

## Implemented Prisma Adapter Controls

- Every observed model must be configured as tenant-scoped or central; unknown/overlapping models fail.
- Model/relation classification is host-supplied and must be reviewed against every schema change;
  adapter validation reports that unverifiable boundary as a warning.
- Supported top-level operations preserve caller filters and append the active tenant predicate.
- Create operations inject/validate the discriminator; updates cannot change it.
- Raw operations, nested relation operations, relation traversal, and unknown operations are rejected.
- The security boundary is only the returned extended client; a retained base client bypasses it.
- Central-model access is allowlisted and explicit central context is the only tenant-model bypass.
- Query callbacks delegate exactly once through Prisma's provided callback so transactions retain scope.
- Errors contain model/operation identifiers but never query arguments, rows, tenants, or database URLs.
- The tenancy extension must be registered last so later query extensions cannot remove scoped arguments.

## Implemented Express Integration Controls

- Applications supply the canonical manager and resolution service; the integration creates no hidden
  tenant state, registry, adapter, or central-mode path.
- Only a `resolved` outcome enters `runWithTenant`; every other outcome fails before tenant routes.
- Missing/invalid identity uses sanitized 400 errors; unknown and suspended tenants share one generic
  404 mapping; ambiguous registry data maps to a generic 500.
- Request header/host input is copied into a frozen resolver snapshot and never appears in default
  error messages.
- Tenant lifecycle remains active until response finish, response close, request abort, or synchronous
  dispatch failure, with idempotent listener removal.
- Express 5 promise rejection handling forwards asynchronous resolver/lifecycle failures; Express 4 is
  outside the tested compatibility boundary.
