# Test Plan: Knex, Lucid, And AdonisJS Vertical Slice

## Unit And Type Tests

- Validate null/invalid/overlapping/unclassified table and model configuration, discriminator names,
  policy names/settings, manager/client inputs, and immutable configuration snapshots.
- Prove supported fluent builders preserve caller filters and types while injecting/validating tenant
  scope at execution; reject every unproven method and escape property.
- Cover insert/update discriminator conflicts, missing/central contexts, callback errors, transaction
  commit/rollback, nested transactions, pooled reuse, and sanitized errors.
- Cover Lucid read/find/fetch/paginate/save/create/update/delete hooks, transaction attachment,
  discriminator immutability, relationships, quiet variants, `.pojo()`, and bulk model queries.
- Cover Adonis config/provider bindings, middleware snapshots/outcomes/error mapping, Japa scopes, and
  Ace-to-CLI argument/result delegation.

## PostgreSQL Integration Tests

- Run the shared row-level adapter contract for Knex and a separate Lucid contract against PostgreSQL
  17 with two tenants and central tables.
- Prove reads, counts, aggregates, creates, bulk creates, updates, deletes, concurrency, transactions,
  savepoints, rollback, and explicit central work cannot cross tenant boundaries.
- Verify RLS is enabled and forced, includes `USING` and `WITH CHECK`, binds the expected application
  role, rejects missing transaction context, and does not leak a setting across pooled connections.
- Attempt retained-base-client, raw, schema, migration, join/union/subquery, OR/clear, unclassified
  table, direct Lucid database builder, hook-skipping, relationship, and privileged-role bypasses.

## Adonis, CLI, And Compatibility Tests

- Start the compiled Adonis application and use Japa/API client to prove concurrent HTTP tenant
  isolation, sanitized missing/invalid/unknown/suspended/ambiguous failures, rollback, and cleanup.
- Prove the Japa helper restores context after success/failure and works with the application plugin.
- Prove Ace commands call shared CLI services exactly once with argument arrays and normalized exits.
- Golden-test dry-run/apply/reapply/conflict/traversal/symlink/redaction behavior for Adonis templates.
- Exercise Knex 3.3/PostgreSQL 17 on Node 22/24 and AdonisJS 7.3/Lucid 22.4/PostgreSQL 17 on Node 24,
  then pack and install all public packages into a clean consumer.
- Verify AdonisJS-generated files use v7 compiler registration, hooks, brace test globs, encryption,
  URL-builder and HTTP type names, package-import aliases, and current file layout where applicable.

## Security Exit Conditions

- No protected surface exposes the base Knex/Lucid client, raw SQL, connection/client internals, or
  automatic schema mutation.
- No error/log/diagnostic includes SQL, bindings, row data, tenant records, identifiers, or URLs.
- Runtime policy validation fails closed; support matrices distinguish supported, rejected, and
  unsupported operations exactly.
