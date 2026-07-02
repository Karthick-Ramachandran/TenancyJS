# Acceptance Criteria: Tenant Identification Testing Contracts

## Criteria

- AC-ID-01: resolver order is explicit and the first present candidate or invalid input stops fallback.
- AC-ID-02: header names are case-insensitive; empty, control-bearing, oversized, and conflicting
  multi-values return typed invalid outcomes.
- AC-ID-03: hosts normalize lowercase, trailing dot, and numeric port safely; schemes, paths, userinfo,
  whitespace, malformed labels, and ambiguous host arrays are invalid.
- AC-ID-04: subdomain extraction requires a configured central domain and one immediate tenant label;
  the exact central domain yields no match.
- AC-ID-05: store results map deterministically to not-found, ambiguous, suspended, or resolved; tenant
  records are shallow-frozen in resolved outcomes.
- AC-ID-06: resolution never authenticates membership and no outcome silently enters central context.
- AC-TEST-01: fixtures are deterministic, immutable snapshots and can be customized without shared state.
- AC-TEST-02: portable core and integration contract cases have no test-runner runtime dependency and
  fail with a typed contract assertion.
- AC-PKG-01: both packages build, typecheck, pack without source/test/compiler caches, install together
  from local tarballs, and execute their public APIs in a clean consumer.

## Out Of Scope

- Non-goals in `PRD.md` and ORM/framework integration behavior from later F-001 tasks.
