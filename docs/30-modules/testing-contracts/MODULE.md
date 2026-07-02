# Module: Testing Contracts

## Purpose

Provide deterministic tenant fixtures and runner-neutral contract cases that prove core and framework
integration lifecycle invariants.

## Owns

- Immutable tenant fixture creation, typed contract assertions/cases, core manager contract cases, and
  integration harness contract cases.

## Does Not Own

- Vitest/Jest/Mocha registration, application factories, databases, ORM fixtures, HTTP clients, or
  framework-specific setup.

## Public Interfaces

- `createTenantFixture`, `TenancyContractCase`, `TenancyContractAssertionError`.
- `createCoreTenancyContract` and `createIntegrationTenancyContract`.

## Boundaries

Depends only on `@tenancyjs/core`. Cases throw on invariant violation and consumers register them with
their chosen runner. Feature source: `docs/40-features/F-002-tenant-identification-testing-contracts/`.
