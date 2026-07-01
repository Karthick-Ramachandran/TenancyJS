# Architecture Impact: Tenancyjs Platform

## Affected Modules

- `core-tenancy`: async context, lifecycle, config primitives, events, and errors.
- `identifiers`: host, subdomain, and header resolver implementations.
- `testing`: core, adapter, framework, CLI, and leak-test contracts.
- `adapter-prisma`, `adapter-sequelize`, `adapter-knex`, `adapter-lucid`.
- `integration-express`, `integration-next`, `integration-nest`, `integration-adonis`.
- `cli`: project analysis, templates/patches, diagnostics, tenant operations, and ORM delegates.

Each boundary gets its own module memory before implementation. Only `core-tenancy` is scaffolded now
because it is the first implementation boundary.

## Dependency Direction

```text
host application
  -> integration-* -> core-tenancy <- adapter-*
                         ^  ^
                         |  +-- identifiers
                         +----- testing contracts consume public APIs

cli -> project analyzer/templates; invokes package APIs and native ORM executables
```

- Core has no framework or ORM runtime dependency.
- Adapters depend on core plus their data-layer peer; adapters never depend on integrations.
- Integrations depend on core plus their framework peer; integrations never implement query scoping.
- Lucid may reuse shared Knex internals through an internal package, but its public contract remains
  distinct because Lucid hooks and Adonis lifecycle are observable behavior.
- NestJS on the Express platform still uses a Nest integration; raw Express remains the reference
  integration and is not advertised as a substitute for Nest lifecycle support.

## Public Interfaces

- `TenancyManager`, `TenantContext`, `TenantRecord`, `TenantResolver`, `TenancyBootstrapper`, and typed
  lifecycle errors in core.
- `TenancyAdapter` capabilities and validation result, with capability flags instead of false parity.
- Framework factories/wrappers that receive a resolver and manager rather than creating hidden
  process-global state.
- CLI driver interfaces for detection, patches, diagnostics, registry access, and native operations.

Exact TypeScript signatures are finalized in the core task and require ADR acceptance first.

## ADR Impact

- ADR-0001 proposes the layered monorepo and package dependency direction.
- ADR-0002 proposes async-local context, strict fail-closed defaults, and explicit central scope.
- ADR-0003 proposes native ORM delegation and safe, transactional project writes.

All remain Proposed. Implementation is blocked until a human accepts or revises them.

## Security Impact

- Tenant identity crosses HTTP, job, CLI, and database trust boundaries.
- Adapters enforce data isolation but do not replace authentication or membership authorization.
- CLI project writes add traversal, symlink, overwrite, partial-write, and secret-exposure risks.
- Native command delegation adds executable resolution, argument injection, concurrency, cancellation,
  and credential-redaction risks.
- No telemetry, cloud service, runtime network service, or secret-store integration is planned.

Security review is required for core context, every adapter, every integration, and CLI mutation work.

## Configuration And Template Impact

- One typed `tenancy.config.ts` surface with framework and adapter extension points.
- Templates are data plus structured transforms; they do not embed a second runtime implementation.
- Existing files are analyzed and patched with preconditions. Full-file overwrite is limited to new
  files and requires explicit approval on collision.
- Generated `.env.example` entries contain names/placeholders only.

## Compatibility Policy

The support matrix is evidence-based. A framework/data-layer combination is `stable` only with a CI
lane, example, conformance tests, peer-version range, and documented limitations. Otherwise it is
`experimental` or `unsupported`; package presence alone is not a compatibility claim.
