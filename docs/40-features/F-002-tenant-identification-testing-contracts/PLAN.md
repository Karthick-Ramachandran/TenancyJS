# Plan: Tenant Identification Testing Contracts

## Approach

1. Accept ADR-0006 and finalize exhaustive result/types.
2. Implement normalization, built-in resolvers, store port, and ordered chain.
3. Implement immutable fixtures and runner-neutral core/integration contract cases.
4. Add deterministic fuzz, failure-path, portability, package, and consumer tests.
5. Run architecture/security/conventions review and update module/F-001 memory.

## Boundaries

- Extract identifiers; do not authenticate users or query external services.
- Do not fall through after a present higher-priority candidate fails lookup.
- Do not put registry behavior inside built-in resolvers.
- Do not expose duplicate tenant records in ambiguous results.
- Do not add a published dependency on the repository's test runner.
