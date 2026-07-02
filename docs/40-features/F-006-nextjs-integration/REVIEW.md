# Review: Nextjs Integration

## Status

Approved for hosted compatibility validation.

## Findings

- No blocker found. Node and Edge responsibilities follow accepted ADR-0009; the Edge export has no
  core, registry, adapter, or database import.
- Resolver snapshots, every non-resolved outcome, forged/malformed hints, concurrent contexts,
  Server Action argument distrust, promise cleanup, and cache/stream boundaries have focused tests.
- The production example retains the base Prisma client only inside runtime construction and exposes
  the protected extended client to handlers/actions.
- Accepted tradeoffs: identity hints remain forgeable untrusted metadata; applications still own
  authentication and membership authorization. Stream callbacks cannot claim tenant database scope.
- Remaining review gate: PostgreSQL production `next start` E2E on Node 22 and 24 in hosted CI.
