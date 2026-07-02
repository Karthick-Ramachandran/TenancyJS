# Module Decisions: Prisma Adapter

## Current Decisions

- Accepted operation, extension, context, raw/nested, and peer-version policy: ADR-0007.
- The secure surface is the returned extended Prisma client; retaining the base client is an explicit
  host-owned escape path.
- Database-per-tenant remains T-11 and is represented as an unsupported capability in T-04.
- Unsupported Prisma paths fail typed and closed rather than receiving best-effort rewriting.
- Central models also declare relation fields so nested access cannot escape through an allowlisted
  model; unknown operations are rejected before central pass-through.
- Prisma generated create types still require non-null tenant fields; runtime injection remains a
  defense and JavaScript capability, while TypeScript callers supply a value that the adapter validates.
- Manual schema classification cannot be proven exhaustive from a generic extension, so adapter
  validation emits a warning and schema changes require review; apply the tenancy extension last.
- CR-001 makes the supported operation matrix the product/security contract, requires educational
  fail-closed errors, migration guidance, and overhead evidence, and leaves static doctor analysis to T-06.

Feature source: `docs/40-features/F-003-prisma-adapter/`.
