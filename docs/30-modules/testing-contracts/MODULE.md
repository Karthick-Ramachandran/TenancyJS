# Module: Testing Contracts

## Purpose

Provide deterministic tenant fixtures and runner-neutral contract cases that prove core and framework
integration lifecycle invariants.

## Owns

- Immutable tenant fixture creation, typed contract assertions/cases, core manager contract cases, and
  integration harness contract cases.
- Runner-neutral row-level adapter harness and two-tenant isolation contract cases.

## Does Not Own

- Vitest/Jest/Mocha registration, application factories, databases, ORM fixtures, HTTP clients, or
  framework-specific setup.

## Public Interfaces

- `createTenantFixture`, `TenancyContractCase`, `TenancyContractAssertionError`.
- `createCoreTenancyContract` and `createIntegrationTenancyContract`.
- `createRowLevelAdapterContract` and its harness/operation/record types.

## Boundaries

Depends only on `tenancyjs-core`. Cases throw on invariant violation and consumers register them with
their chosen runner. The package imports no ORM or test runner. Feature sources:
`docs/40-features/F-002-tenant-identification-testing-contracts/` and
`docs/40-features/F-003-prisma-adapter/`.
