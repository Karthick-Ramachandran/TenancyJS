# Module: Prisma Adapter

## Purpose

Enforce row-level tenant isolation for supported Prisma Client operations by translating the active
core tenant context into safe Prisma query arguments.

## Owns

- Prisma model classification and tenant-discriminator configuration.
- Supported operation capabilities and configuration validation.
- Filter composition, create/update tenant-field enforcement, and typed unsupported-path failures.
- The shareable Prisma query extension factory and Prisma-specific errors.
- Prisma/PostgreSQL conformance evidence, operation matrix, migration guidance, and policy benchmark.

## Does Not Own

- Tenant context storage, tenant identification, authentication, or membership authorization.
- Prisma schema generation, migrations, client construction, connection URLs, or secret management.
- Framework middleware, database-per-tenant provisioning, RLS, raw SQL safety, or nested relation support.
- Protection for a base Prisma client retained outside the returned extension.

## Public Interfaces

- `createPrismaTenancyExtension(options)` and `createPrismaAdapter(options)`.
- `definePrismaTenancyConfig`, `classifyPrismaModel`, and immutable
  `PRISMA_ADAPTER_CAPABILITIES`/supported-operation metadata.
- Typed configuration, unregistered-model, tenant-field-conflict, and unsupported-operation errors.
- Framework-neutral `TenancyAdapter` capabilities and validation results from core.
- Educational typed errors that point to supported native Prisma alternatives without disclosing data.

## Boundaries

Depends on public `tenancyjs-core` context/contracts and a tested Prisma Client peer. It never imports
a framework or integration, stores tenant context, invokes Prisma CLI, rewrites schema files, or opens
a second connection. Host applications apply the returned extension and expose only that extended
client to tenant-aware code. Prisma's generated non-null create input still requires the discriminator;
the adapter validates it and injects it for runtime inputs that omit it. Feature source:
`docs/40-features/F-003-prisma-adapter/`.

The shared guarantee is defined in `docs/20-security/ADAPTER_SECURITY_CONTRACT.md`; the package matrix,
migration guide, and benchmark are public package artifacts.
