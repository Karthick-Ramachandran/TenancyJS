# Module Test Plan: Tenant Identifiers

## Unit Tests

- Normalization tables and deterministic generated hostile strings.
- Resolver match/no-match/invalid behavior and configuration validation.
- Precedence plus all store-result outcomes.

## Integration Tests

- Full chain against a fake store and packed consumer public API.

## Security Tests

- Control characters, ambiguous values, host confusion, no unsafe fallback, no tenant-list disclosure.

## Current Evidence

- Resolver/chain coverage exceeds configured global thresholds within 68 total repository tests.
- Deterministic generation exercises 500 hostile/random host strings and normalization idempotence.
- Three-package tarballs install and execute together in a clean scripts-disabled consumer.
