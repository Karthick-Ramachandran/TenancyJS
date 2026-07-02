# Conventions

The canonical, reusable vocabulary for this repository. Agents reference these by name and reuse them
instead of inventing new components, helpers, or patterns. Repository rules override model
preferences.

## Canonical Primitives

- `TenantContext`: immutable tenant execution state owned by `@tenancyjs/core`.
- `TenancyManager`: the only public lifecycle entry point for tenant and central execution scopes.
- `TenancyBootstrapper`: context-local setup/revert contract registered at manager construction.
- `TenancyLifecycleError`: combined evidence when lifecycle cleanup fails.
- `TenantResolver`: framework-neutral tenant resolution contract.
- `TenantResolutionOutcome`: exhaustive, non-secret result of ordered resolver plus tenant-store lookup.
- `TenancyContractCase`: runner-neutral `{ name, run }` conformance case from `@tenancyjs/testing`.
- `TenancyAdapter`: implemented ORM-neutral capability and validation contract owned by core.
- `createPrismaTenancyExtension`: canonical Prisma row-level extension factory; never expose a base
  Prisma client as the protected application client.
- `createExpressTenancyMiddleware`: canonical Express 5 request-lifecycle bridge; it composes an
  application-owned `TenancyManager` and tenant resolver and never creates hidden tenant state.
- `createRowLevelAdapterContract`: runner-neutral two-tenant adapter conformance suite.
- `ProjectChangePlan`: canonical immutable CLI preview/apply contract; content is never printed in
  normal output and every action is revalidated before commit.
- `runDoctor`: canonical deterministic CLI diagnostic entry point with stable findings and exit mapping.
- `TenancyIntegration`: framework lifecycle bridge contract.
- Conformance suites in `@tenancyjs/testing`: required evidence for stable adapters and integrations.
- `pnpm check`: canonical repository gate for lint, format, types, tests, package verification, and
  Persist memory validation.

Core, resolver, outcome, contract-case, adapter, Prisma-extension, and Express-middleware names above
are implemented contracts. `TenancyIntegration` remains the framework-neutral planned vocabulary; do
not introduce a competing name without updating the feature plan and an ADR where applicable.

## Naming Conventions

- npm packages use `@tenancyjs/<name>` with `adapter-*` and `integration-*` prefixes.
- Repository module folders use kebab-case; public TypeScript types use PascalCase.
- Adapter packages name the public data-layer surface: `adapter-prisma`, `adapter-sequelize`,
  `adapter-knex`, and `adapter-lucid`.
- Acceptance criteria use stable IDs (`AC-*`); implementation tasks use stable IDs (`T-*`).

## Rules

- Do not import a framework or ORM from `@tenancyjs/core`.
- Do not publish an adapter or integration as stable unless its conformance suite and example E2E pass.
- Do not duplicate tenant-context storage in an adapter or integration; use `TenancyManager`.
- Do not execute ORM CLI commands through a shell; use an argument-array process runner.
- Do not patch project files without dry-run output, path validation, and conflict detection.
- Do not call a task complete unless `pnpm check` passes; list any environment-specific skipped lanes.

## Anti-Patterns

- A process-global `currentTenant`; use async-scoped `TenantContext`.
- Treating resolver failure as central mode; return an explicit resolution error or central-route result.
- Claiming Lucid support through Knex alone; use the Lucid adapter and Adonis lifecycle integration.
- Reimplementing migrations in TenancyJS; delegate through the selected data-layer driver.
- Building every compatibility combination before one secure vertical slice is production-ready.
