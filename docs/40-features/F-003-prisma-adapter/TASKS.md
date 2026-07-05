# Tasks: Prisma Adapter

## P1: Plan Module And Decide Isolation Boundary

Status: Complete; ADR-0007 accepted.

Scope: Feature/module memory, current Prisma API research, operation matrix, dependency policy, and
ADR-0007 proposal.

Acceptance: PRD, acceptance, architecture impact, plan, test plan, module memory, and ADR explain all
supported and rejected paths without claiming implementation.

Tests: `persist doctor`.

Do Not: Implement runtime code before ADR acceptance.

## P2: Define Adapter Contract And Configuration

Status: Complete.

Scope: Generic `TenancyAdapter` capabilities/validation types, Prisma model configuration, validation,
and typed errors.

Acceptance: AC-PRISMA-01, AC-PRISMA-02, and the capability portion of AC-PRISMA-08.

Tests: Invalid/overlapping/empty model maps, tenant-field validation, immutable normalized config,
unknown model, missing/central/tenant contexts, and capability snapshots.

Do Not: Import Prisma into core or infer model security from naming conventions.

## P3: Implement Supported Prisma Operation Policies

Status: Complete.

Scope: Safe filter composition, create/update discriminator enforcement, central pass-through, raw and
nested rejection, and the shareable extension factory.

Acceptance: AC-PRISMA-03 through AC-PRISMA-08.

Tests: Every advertised operation, conflicting predicates/data, compound unique reads, bulk arrays,
unsupported operations, single delegation, thrown-query propagation, and transaction-safe callbacks.

Do Not: Rewrite `select`/`include`, support relation operations speculatively, or query through a
captured base client.

## P4: Add Shared Adapter Contract

Status: Complete.

Scope: Runner-neutral harness/cases in `tenancyjs-testing` for two-tenant row-level isolation.

Acceptance: Contract cases cover AC-PRISMA-03 through AC-PRISMA-09 without importing Prisma.

Tests: Contract self-tests prove a leaky harness fails and a correctly scoped in-memory harness passes.

Do Not: Add a Vitest/Jest runtime dependency to the published testing package.

## P5: Prove PostgreSQL Integration And Package Delivery

Status: Complete.

Scope: Dedicated Prisma schema/client, disposable PostgreSQL lane, transaction and negative E2E tests,
README, Changeset, tarball consumer execution, and CI wiring.

Acceptance: AC-PRISMA-09 and AC-PRISMA-10; tested Node/Prisma lanes and all package gates pass.

Tests: Real PostgreSQL two-tenant contract, interactive/batch transactions, central model, raw/nested
rejection, clean consumer, typecheck, and package contents.

Do Not: Use SQLite as the only isolation evidence or expose connection credentials in logs/docs.

## P6: Review And Complete T-04

Status: Complete; hosted CI passes on PR #6.

Scope: Independent architecture/conventions/security passes, memory updates, root T-04 status, quality
gates, audit, and completion report.

Acceptance: No blocker remains; `pnpm check` and `persist doctor` pass; skipped lanes and risks are explicit.

Tests: Full local gates plus hosted Node 22/24 and PostgreSQL checks after publication.

Do Not: Mark AC-ADAPTER-01 complete for non-Prisma adapters or claim database-per-tenant support.

## P7: Harden The Supported Security Contract

Status: Complete; hosted CI passes on PR #6.

Scope: Adapter Security Contract, operation matrix, greenfield/existing-app migration guide,
educational typed errors, startup/context guidance, Doctor requirements, and overhead benchmark.

Acceptance: AC-PRISMA-11 through AC-PRISMA-16.

Tests: Educational error assertions, packed documentation checks, repeatable seven-sample benchmark,
full PostgreSQL gate, audit, and Persist Doctor.

Do Not: Introduce a TenancyJS query language, implement CLI analysis inside the adapter, claim raw or
nested enforcement, or set a benchmark threshold from one local machine.
