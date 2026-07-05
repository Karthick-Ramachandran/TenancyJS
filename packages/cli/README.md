# `tenancyjs-cli`

Safe, deterministic project initialization and diagnostics for TenancyJS.

Init supports Express 5.2 with Prisma 7.8, TypeORM 1, Sequelize 6.37, or Drizzle 0.45; AdonisJS 7.3
with Lucid 22.4; and Next.js 16 with Prisma 7.8. It detects the stack from `package.json` and scaffolds
the matching row-level wiring. It uses
Node built-ins only, makes no network calls, reads no `.env` files, and never invokes a shell or remote
package runner.

## Commands

```bash
# Preview new wiring files; this is the default and writes nothing.
tenancy init

# Create only non-conflicting files after path and symlink validation.
tenancy init --apply
tenancy init --framework express --orm drizzle --apply

# Inventory wiring, versions, base clients, raw/nested/relation usage,
# model classification, leak-test evidence, and migration effort.
tenancy doctor
tenancy doctor --json

# Run one explicit, contained JavaScript leak test directly with local Node.
tenancy test:leak --test-file test/tenancy.leak.test.mjs
```

All commands accept `--root <path>`. `init` never overwrites: matching files are unchanged and
differing files are conflicts. Generated writes are staged and rolled back if commit fails.

Doctor exit codes are `0` healthy, `1` warnings, and `2` errors. `test:leak` returns `0` only when the
explicit test file exits successfully. Output redacts URL credentials and secret-like assignments.

## Generated Files

Express + Prisma, TypeORM, Sequelize, or Drizzle:

- `tenancy.config.ts`
- `src/tenancy/register.ts`
- `src/middleware/tenancy.ts`

AdonisJS + Lucid:

- `config/tenancy.ts`
- `app/middleware/tenant_middleware.ts`

The generated classification is intentionally empty. Classify every model as tenant or central and add
a real leak test before Doctor can pass. For AdonisJS, register the provider in `adonisrc.ts`, apply
the middleware to tenant route groups, and add a migration that enables and FORCES PostgreSQL row-level
security under a non-privileged runtime role. Static Doctor output estimates migration work; it does
not prove runtime tenant isolation.

## Security Boundary

- Project roots are canonicalized with `realpath`.
- Absolute paths, traversal, symlink parents/destinations, duplicate paths, and overwrites are rejected.
- `.env`, dependencies, generated/build output, VCS metadata, binaries, and large source files are not
  consumed as configuration.
- Only the explicit `test:leak` JavaScript file is executed, via `process.execPath` and an argument
  array. The CLI never invokes a shell. The trusted test is not sandboxed, receives only allowlisted
  database/test/Tenancy environment variables, and is bounded to 120 seconds and 1,000,000 output
  characters by default.
- Init never connects to a database or runs migrations; operational migration/provisioning commands
  delegate only to explicit host runtime hooks.
