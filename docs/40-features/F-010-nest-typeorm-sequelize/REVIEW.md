# Review: Nest Typeorm Sequelize

## Status

Implementation review passed locally, including adapter-backed Nest request evidence.

## Findings

- Accepted ADR-0023/0024/0025 preserve dependency direction and make security boundaries explicit.
- Sequelize 6 stable is selected over v7 alpha. PostgreSQL 17 remains the only initial SQL provider.
- Nest's guard/interceptor split reflects actual lifecycle ordering; no imperative ALS entry is used.
- Architecture: TypeORM and Sequelize reuse `createPostgresStrategyEngine` and
  `createTenantResourceCache`; neither duplicates dialect SQL or connection-cache lifecycle.
- Security: schema mode rejects qualified config and fixed-schema ORM metadata, blocks tenant/central
  cross-placement access, and exposes no raw/native object. Database mode resolves only registered
  entities/model names on the leased tenant resource.
- Isolation evidence: each ORM passes real PostgreSQL two-schema and two-database tests with colliding
  IDs, tenant-A mutation checks, and public placement-collision rejection.
- Cross-stack evidence: a real NestJS 11 Express application uses the TypeORM protected facade against
  forced PostgreSQL RLS; concurrent requests with the same row ID return only their tenant and missing
  identity fails before controller data access.
- Quality: the full PostgreSQL/MySQL/MongoDB gate passes 587 tests, coverage floors, all 15 package
  archives/consumers, and Persist Doctor. No high-severity dependency advisory is present.
- Remaining risk: shared-role schema mode and over-privileged database credentials remain
  adapter-routed rather than database-authorized; docs state the credential/role requirement.
- External evidence still required before a stable release: hosted CI and a consumer installing the
  actually published npm artifacts rather than workspace-packed tarballs.
