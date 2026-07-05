# Acceptance Criteria: Tier-Aware Query Freedom

## Criteria

- A scope resolves to `database-enforced` only when isolation is genuinely below the query layer:
  database-per-tenant, OR row-level with forced RLS validated, OR schema-per-tenant with a per-tenant
  role. Everything else resolves to `facade-enforced`.
- In a `database-enforced` scope, a nested read, a join, and a raw query all succeed AND a two-tenant
  adversarial test (colliding ids) proves neither tenant can observe the other's rows via any of them.
- In a `facade-enforced` scope, raw/native/nested access is still rejected exactly as today.
- No valid tenant context still throws in every tier; central scope, cross-placement rejection, and
  disposal are unchanged.
- Each adapter/tier flip of `nestedReads`/`nestedWrites`/`rawQueries` is backed by a passing adversarial
  test on a real database and an independent review.
- Full gate green; `persist doctor` clean.

## Out Of Scope

- Any relaxation on MySQL/MongoDB/role-less schema-per-tenant.
