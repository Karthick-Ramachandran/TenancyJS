# Review: Tenancyjs Platform

## Status

Feature implementation in progress. T-01 passed architecture, conventions, and security review.

## Findings

- The BRD/PRD and CLI research describe a credible destination but overstate P0 breadth. The delivery
  plan replaces simultaneous support with evidence-gated vertical slices.
- Next.js and NestJS do not remove the need for a small raw Express integration. Express provides the
  lowest-level HTTP reference and a useful isolation test bed.
- Lucid must have a dedicated public adapter even if it shares Knex implementation primitives.
- Row-level isolation must be proven before database-per-tenant operations add provisioning and
  credential-handling risk.
- Mongoose and Drizzle are deferred from the user's current four-data-layer scope; adding either later
  requires a change request, module plan, and conformance lane.
- Architecture ADRs require human acceptance before their implementation begins; ADR-0001 through
  ADR-0004 have now passed that gate.

## T-01 Review

- ADR-0001 through ADR-0004 are accepted; the workspace follows the documented package direction and
  uses the approved minimal toolchain without introducing a task orchestrator.
- `@tenancyjs/core` is only a package shell. It has no framework, ORM, runtime dependency, or product
  behavior, so T-02 remains the boundary for tenant-context implementation.
- The README describes both single-database and database-per-tenant strategies while labeling all
  compatibility and installation examples as pre-alpha/planned.
- GitHub Actions are pinned to reviewed commit SHAs. Dependabot covers npm and Actions updates.
- Static secret/path review found no credentials, symlinks, `.env` reads, telemetry, runtime network,
  cloud, MCP, or AI behavior. The only subprocess is the local pack check, invoked without a shell and
  writing to a newly created OS temporary directory.
- `pnpm audit --audit-level high` reported no known vulnerabilities.
- No blocking convention or security findings remain. CI execution on GitHub is deferred until the
  repository is pushed; equivalent gates passed in a clean temporary workspace.

## T-02 Review

- Architecture: implementation follows ADR-0001, ADR-0002, and ADR-0005. Core imports only Node's
  `AsyncLocalStorage`; it has no framework, ORM, or runtime package dependency.
- Module boundary: core owns context/lifecycle/config/error primitives only. It does not resolve
  tenants, scope ORM queries, authenticate users, provision databases, write files, or expose bypass.
- Conventions: canonical `TenantContext`, `TenancyManager`, and `TenancyBootstrapper` names are reused;
  no competing context store or process-global tenant was introduced.
- Security: missing/central tenant access fails typed and closed; nested/concurrent scopes restore;
  tenant snapshots are shallow-frozen; cleanup continues after listener/revert failures and preserves
  complete error evidence.
- Supply chain: `@types/node` is development-only and aligned to the Node 24 support floor; core has no
  production dependencies; `pnpm audit --audit-level high` reports no known vulnerabilities.
- Tests: 24 tests pass with 100% statement/function/line and 94.11% branch coverage. The tarball installs
  into a fresh temporary consumer with install scripts disabled and executes the public API.
- No architecture, dependency, module, security, testing, documentation, or engineering-standards
  blocker remains. Historical Node 22/24 evidence passed; ADR-0013 now requires Node 24 CI.

## Consolidated GitHub Actions Dependency Review

- Dependabot PRs #1 and #2 were reviewed and incorporated together: `actions/checkout` 4.3.1 to
  7.0.0 and `actions/setup-node` 4.4.0 to 6.4.0.
- Both Actions remain pinned to the exact Dependabot-reviewed commit SHA. Workflow permissions stay
  read-only, no secrets or credentials were added, and no runtime or package dependency changed.
- The checkout upgrade includes stricter fork checkout handling. Its Node.js 24 action runtime is
  compatible with the repository's `ubuntu-latest` runners; the isolated Dependabot PR passed the
  repository's Node 22, Node 24, and Persist Doctor checks.
- Historical setup-node evidence covered Node 22/24; ADR-0013 now narrows the active matrix to Node 24
  and preserves pnpm cache configuration. The isolated Dependabot PR passed the historical hosted
  checks.
- `pnpm check` and `pnpm audit --audit-level high` pass after combining both updates with T-02 and
  T-03. No architecture, module, product behavior, or accepted ADR changes are required.

## T-04 Review

- ADR-0007 is accepted and the Prisma adapter follows the separate-package dependency boundary.
- Supported top-level operations pass the shared row-level contract and Prisma 7.8/PostgreSQL 17
  negative isolation tests; raw, nested, fluent relation, unknown model/operation, and missing-context
  paths fail closed.
- Core gained only ORM-neutral adapter types; testing remains runner/ORM-neutral; no framework or
  database-per-tenant behavior was introduced.
- Dependency, architecture, conventions, and security review found no blocker. Detailed findings and
  tradeoffs live in `docs/40-features/F-003-prisma-adapter/REVIEW.md`.
