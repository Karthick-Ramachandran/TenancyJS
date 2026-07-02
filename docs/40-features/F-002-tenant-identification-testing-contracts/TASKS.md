# Tasks: Tenant Identification Testing Contracts

## T03-01: Accept Contract And Module Boundaries

Status: Done — ADR-0006 accepted 2026-07-02.

Scope:

- Fill F-002 and module memory; accept ADR-0006.

Acceptance:

- Persist memory validates and implementation interfaces are testable.

Tests:

- `persist doctor`.

Do Not:

- Start source implementation before ADR-0006 is accepted.

## T03-02: Implement Tenant Identifiers

Status: Done — source, type, normalization, resolver-chain, fuzz, and security tests pass.

Scope: Public types, normalizers, built-in resolvers, store port, and ordered chain.

Acceptance: AC-ID-01 through AC-ID-06.

Tests: Unit, deterministic fuzz, resolver precedence, registry outcome, and security cases.

Do Not: Add persistence/network/auth or framework middleware.

## T03-03: Implement Portable Testing Contracts

Status: Done — fixtures and core/integration contract cases pass self-tests.

Scope: Fixtures, typed contract errors/cases, core contract, and integration harness contract.

Acceptance: AC-TEST-01 and AC-TEST-02.

Tests: Self-test contracts with passing and intentionally broken harnesses.

Do Not: Add a published test-runner dependency.

## T03-04: Package, Review, And Record Evidence

Status: Done — completed 2026-07-02 after approved workspace refresh and final reviews.

Scope: Package metadata, builds, Changesets, consumer checks, reviews, and memory updates.

Acceptance: AC-PKG-01 and all repository gates.

Tests: `pnpm check`, clean-copy install, package consumer, audit, and `persist doctor`.

Do Not: Mark T-03 complete before hosted CI or explicitly record it as pending push.
