# Test Plan: Tenant Identification Testing Contracts

## Unit Tests

- Header and host normalization tables, duplicate casing, conflicting arrays, invalid bytes and lengths.
- Subdomain boundary/central-domain cases and ordered resolver precedence.
- Zero/one/multiple/suspended store matches and shallow tenant immutability.
- Fixture independence and contract-case success/failure behavior.

## Integration Tests

- Fake tenant store through the full resolver chain.
- Fake framework bridge through portable integration contract cases.
- Packed core/identifiers/testing tarballs installed together in a clean consumer.

## Security Tests

- Header/host injection characters, schemes, userinfo, paths, whitespace, and ambiguous values.
- Unknown explicit identifier cannot fall back to another resolver.
- Ambiguous/suspended results do not expose data or initialize tenancy.
- Deterministic generated strings exercise normalization invariants without external fuzz dependencies.

## Gates

Source/test typecheck, lint, coverage thresholds, package allowlist, Changesets, dependency audit,
architecture/security/conventions review, clean-copy `pnpm check`, and Persist Doctor.
