# Migrating To The Secured Prisma Client

TenancyJS v1 is designed first for greenfield applications, where the secured client and supported
operation matrix can be adopted before tenant-aware data access spreads through the codebase. Existing
applications can migrate incrementally, but an unreviewed mixture of secured and base clients is not a
safe final state.

## Greenfield Path

1. Put a non-null tenant discriminator and appropriate indexes on every tenant-owned model.
2. Construct Prisma Client in one infrastructure module.
3. Classify every tenant/central model and every relation field.
4. Apply `createPrismaTenancyExtension(...)` last and export only the extended client.
5. Resolve/authenticate/authorize the tenant once at the request or job boundary, then enter
   `TenancyManager.runWithTenant`.
6. Run the shared adapter contract and application-specific two-tenant leak tests in CI.

The safe application path continues to use native Prisma APIs such as `findMany`, `create`,
`updateMany`, and `$transaction`; TenancyJS does not introduce a parallel query language.

## Existing Application Inventory

Before switching imports, inventory:

- every `new PrismaClient` and exported client instance;
- `$queryRaw`, `$executeRaw`, unsafe raw variants, and TypedSQL entry points;
- `include`, relation-valued `select`, fluent relation traversal, and nested writes;
- background jobs or scripts that query without request context;
- administrative/central queries and schema model additions;
- extensions registered before or after the tenancy extension.

Migrate one bounded module at a time, add two-tenant negative tests, then remove its base-client access.
Do not label the application protected while tenant-aware paths still import an unextended client.

## Pattern Replacements

| Existing pattern                    | Migration path                                                                                                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Multiple/base Prisma clients        | Centralize construction; apply TenancyJS last; export only the secured client                                                                                                                     |
| Nested create/update                | Split into supported top-level model operations inside one native `$transaction`                                                                                                                  |
| Relation `include`/fluent traversal | Query the related tenant-scoped model directly using its foreign key; tenant scope is appended automatically                                                                                      |
| Relation filters                    | Replace with supported direct-model queries or a reviewed application service composed from top-level operations                                                                                  |
| Raw SQL used for ordinary CRUD      | Replace with supported Prisma model operations                                                                                                                                                    |
| Raw SQL with no safe ORM equivalent | Keep it outside the TenancyJS guarantee in a separately reviewed privileged module, or enforce isolation in the database (for example reviewed RLS); never expose it as tenant-safe by convention |
| Context-free background work        | Resolve/authorize the tenant from trusted job metadata and wrap the job in `runWithTenant`                                                                                                        |
| Cross-tenant administration         | Use explicit `runInCentralContext` in a privileged service with application authorization/audit controls                                                                                          |
| New/renamed schema relation         | Update classification, review the startup warning, and rerun conformance tests before deployment                                                                                                  |

## Create Inputs In TypeScript

Prisma query extensions cannot change generated input types. A non-null `tenantId` remains required by
the generated TypeScript create input. Supply the active tenant value; the adapter validates it and
rejects conflicts. JavaScript/runtime inputs that omit it receive injection, but schema nullability
should not be weakened for convenience.

## Failure Messages

Adapter failures identify the model/operation, explain why TenancyJS cannot prove isolation, and point
to a safe alternative. They intentionally exclude query arguments, SQL text, row data, tenant records,
and database connection values.

## Future Doctor Support

The planned `tenancy doctor` command will inventory base-client construction, unsupported raw/nested/
relation patterns, incomplete classification, extension ordering, and affected files to estimate
migration effort. Until that CLI task ships, use repository search plus the checklist above.
