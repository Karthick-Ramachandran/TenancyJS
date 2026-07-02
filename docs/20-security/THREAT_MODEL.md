# Threat Model

## Status

Active and incremental. Core-context, tenant-resolution, and Prisma row-level adapter controls are
implemented; other adapter, integration, and CLI controls remain delivery requirements.

## Assets

- Tenant-owned application data and isolation boundaries.
- Tenant identity, domains, status, and database connection metadata.
- Host-application credentials passed to adapters or child processes.
- Integrity of projects modified by the CLI and integrity of published npm packages.
- Availability of request handling and bulk tenant operations.

## Entry Points

- Host, path, header, token claim, API key, job payload, and custom resolver input.
- Tenant IDs, filters, model data, raw queries, transaction callbacks, and central/bypass API calls.
- CLI flags, config paths, project files, package metadata, tenant registry records, and child output.
- Framework and ORM peer APIs, package installation, generated templates, and migration executables.

## Trust Boundaries

- Untrusted request/job metadata to a validated tenant-registry result.
- Framework lifecycle to async core context.
- Core context to adapter query/connection behavior and the tenant datastore.
- CLI input/project contents to filesystem mutations and local executable invocation.
- TenancyJS packages to framework, ORM, database, and package-manager dependencies.

## Threats

- Spoofing: forged host/header/token or stale cache maps a request to another tenant.
- Tampering: a query or nested/bulk operation removes the tenant predicate; CLI paths or project
  metadata redirect writes; subprocess arguments alter the intended command.
- Repudiation: central/bypass operations and bulk tenant commands lack enough outcome evidence to
  diagnose who or what crossed a boundary.
- Information disclosure: unscoped queries, aggregates, errors, logs, diagnostics, or child output
  reveal another tenant's data or database credentials.
- Denial of service: resolver amplification, unbounded tenant migration concurrency, connection-pool
  growth, or hostile project files exhaust resources.
- Elevation of privilege: resolver failure falls back to central scope, request data activates bypass,
  or a symlink/executable substitution grants access outside the project.

## Mitigations

- Validate and normalize resolver input, resolve against a trusted registry, reject ambiguity, and
  bind cached results to explicit expiry/invalidation behavior.
- Default to strict missing-context failures, immutable async context, explicit central/bypass APIs,
  reverse-order cleanup, and shared two-tenant adapter conformance tests.
- Capability-gate unsupported adapter operations and document raw-query boundaries.
- Redact secrets and tenant records from normal output; provide structured per-tenant operation results.
- Bound concurrency, timeouts, retries, and connection lifetime for operational commands.
- Use dry-run plans, realpath containment, symlink rejection, preconditioned writes, local executable
  resolution, and argument-array process spawning.
- Require dependency review, peer-version CI, package-consumer tests, and release evidence.

## Open Risks

- Prisma nested relation/raw capabilities remain outside the accepted adapter security boundary and
  are rejected; Prisma major updates require renewed compatibility evidence.
- Next.js runtime/caching evolution and Edge identity handoff: integration owner; prototype in T-07.
- Raw SQL cannot be made universally safe: adapter/documentation owners; explicit escape policy needed.
- Atomic rollback across filesystem and database operations is impossible: CLI owner; staged,
  idempotent operations and recovery output required.
- Framework and ORM peer versions remain unresolved until their integration tasks: package owners.
- Shallow tenant snapshots do not freeze custom nested metadata: host applications must treat nested
  values as application-owned and avoid mutating security-relevant metadata during a scope.
