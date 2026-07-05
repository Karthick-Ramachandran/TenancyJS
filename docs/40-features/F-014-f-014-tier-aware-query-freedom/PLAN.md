# Plan: Tier-Aware Query Freedom

## Approach

Introduce `resolveEnforcementTier(context, config)` in each adapter (or shared where possible). In
`run()`, after the tenant context/transaction is established, branch: `database-enforced` → invoke the
callback with the real scoped client/transaction; `facade-enforced` → invoke with the protected facade
(unchanged). Ship per tier, each gated on its own adversarial test + independent review:

1. **database-per-tenant** — the leased connection is the tenant's DB; expose it directly. Safest first.
2. **PostgreSQL row-level + forced RLS** — expose the RLS-scoped transaction; RLS covers joins/raw.
3. **schema-per-tenant + per-tenant role** — expose the role+search_path transaction; the role denies
   sibling schemas even under raw SQL.

## Boundaries

- Facade-only tiers (MySQL row-level, Mongoose, role-less schema-per-tenant) keep the restricted facade.
- `database-enforced` is derived from real enforcement (validated RLS / configured role / separate
  connection), never a flag. Fail-closed-on-context is untouched.
- One adapter + one tier per increment; nothing accepted without a passing adversarial test + review.
