# Module Decisions: Prisma Adapter

## Current Decisions

- Accepted operation, extension, context, raw/nested, and peer-version policy: ADR-0007.
- The secure surface is the returned extended Prisma client; retaining the base client is an explicit
  host-owned escape path.
- Database-per-tenant is supported through the shared bounded cache; PostgreSQL and MySQL each have
  separate-database adversarial evidence.
- ADR-0030 owns PostgreSQL schema-per-tenant through the Prisma 7 driver adapter's explicit schema
  option. Runtime `search_path` remains rejected.
- Unsupported Prisma paths fail typed and closed rather than receiving best-effort rewriting.
- Central models also declare relation fields so nested access cannot escape through an allowlisted
  model; unknown operations are rejected before central pass-through.
- Prisma generated create types still require non-null tenant fields; runtime injection remains a
  defense and JavaScript capability, while TypeScript callers supply a value that the adapter validates.
- Manual schema classification cannot be proven exhaustive from a generic extension, so adapter
  validation emits a warning and schema changes require review; apply the tenancy extension last.
- CR-001 makes the supported operation matrix the product/security contract, requires educational
  fail-closed errors, migration guidance, and overhead evidence, and leaves static doctor analysis to T-06.
- The extension rewrites query arguments, not database SQL, so isolation is database-agnostic. It is
  proven against both PostgreSQL and MySQL (two-tenant integration suites). MySQL lacks SQL RETURNING,
  so Prisma's `createManyAndReturn`/`updateManyAndReturn` are unavailable there — a Prisma/MySQL
  limitation, not a tenancy gap.

Feature source: `docs/40-features/F-003-prisma-adapter/`.
