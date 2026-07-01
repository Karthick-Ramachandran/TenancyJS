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
- Supply chain: `@types/node` is development-only and aligned to the Node 22 support floor; core has no
  production dependencies; `pnpm audit --audit-level high` reports no known vulnerabilities.
- Tests: 24 tests pass with 100% statement/function/line and 94.11% branch coverage. The tarball installs
  into a fresh temporary consumer with install scripts disabled and executes the public API.
- No architecture, dependency, module, security, testing, documentation, or engineering-standards
  blocker remains. Hosted Node 22/24 CI is pending the next push.
