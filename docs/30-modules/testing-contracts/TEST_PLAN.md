# Module Test Plan: Testing Contracts

## Unit Tests

- Fixture defaults, overrides, independence, and shallow immutability.
- Contract assertion messages and case determinism.

## Integration Tests

- Run core cases against `TenancyManager` and integration cases against correct/broken fake bridges.
- Install packed package in a clean consumer with core and identifiers.

## Security Tests

- Contract cases prove missing-context cleanup and cross-concurrent tenant isolation.

## Current Evidence

- Core contract cases pass against `TenancyManager`.
- Integration cases pass a correct bridge and raise `TenancyContractAssertionError` for a broken bridge.
- Published package has only the core runtime dependency and no test-runner dependency.
