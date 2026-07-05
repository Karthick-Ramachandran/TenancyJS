# Test Plan: Tier-Aware Query Freedom

## Unit Tests

- `resolveEnforcementTier` returns `database-enforced` exactly for db-per-tenant, row-level+validated-RLS,
  and schema-per-tenant+role; `facade-enforced` for MySQL row-level, Mongoose, role-less schema-per-tenant.
- `facade-enforced` scopes still reject raw/native/nested.

## Integration / Adversarial Tests (real databases)

- Per freed tier+adapter: tenant A and tenant B with colliding-id rows. Run, inside A's scope, a **raw
  query**, a **join**, and a **nested read** across tenant tables; assert only A's rows are returned and
  the test would fail if B's leaked. Repeat inside B's scope.
- Confirm no context still throws; central scope and cross-placement rejection unchanged.

## Security Tests

- In a role-less schema-per-tenant scope, a raw query qualifying a sibling schema must still be rejected
  (stays facade-enforced).
- Handing over the real client must never happen in a facade-only scope (assert the tier gate).
