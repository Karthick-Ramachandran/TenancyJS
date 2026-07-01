# ADR-0004: TypeScript Workspace Quality Toolchain

## Status

Accepted

## Context

T-01 needs deterministic workspace, build, type, test, format, lint, package, and release tooling
before runtime packages are implemented. The repository must remain understandable to contributors
and avoid adding orchestration infrastructure before package count or CI measurements justify it.

## Decision

Use pnpm workspaces on supported Node.js LTS releases with:

- TypeScript project references and `tsc` for typechecking and package builds;
- Vitest for unit and integration test execution;
- ESLint flat configuration with typescript-eslint for static analysis;
- Prettier for deterministic formatting;
- Changesets for package versioning and release notes;
- small repository-owned Node scripts/tests for package-boundary and package-export checks.

Root scripts are the canonical gates. Do not add Turbo, Nx, or another task orchestrator until
measured workspace performance or remote-cache requirements justify a superseding ADR.

## Alternatives Considered

- Turbo from day one: useful at scale, but adds configuration and cache semantics before the workspace
  has enough packages to benefit.
- tsup or another bundler: convenient, but core is ESM TypeScript with no bundling requirement yet.
- Jest: mature, but Vitest aligns with ESM and TypeScript while keeping future browser-capable tests open.
- Node's test runner only: dependency-free, but weaker TypeScript-native authoring and test ergonomics
  for the planned adapter and framework conformance suites.

## Consequences

The initial toolchain is conventional, explicit, and easy to run locally or in CI. Project references
make package dependencies visible. The repository accepts several development dependencies and must
keep them reviewed and updated. Sequential pnpm scripts may become slow later; that is evidence for a
future orchestrator decision, not a reason to preinstall one now.

## Related Documents

- PRD: `docs/00-product/PRD.md`
- Architecture: `docs/10-architecture/ARCHITECTURE.md`
- Security: `docs/20-security/SECURITY_MODEL.md`
- Feature: `docs/40-features/F-001-tenancyjs-platform/TASKS.md`
