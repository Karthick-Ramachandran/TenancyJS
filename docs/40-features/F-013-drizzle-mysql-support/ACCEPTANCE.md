# Acceptance Criteria

- **AC-001:** `tenancyjs-adapter-drizzle` publishes a typed, callback-scoped facade and exposes no raw
  or native database handle.
- **AC-002:** PostgreSQL row-level tests prove forced-RLS isolation with colliding tenant IDs.
- **AC-003:** PostgreSQL schema tests prove two schemas with colliding IDs cannot cross-read or mutate.
- **AC-004:** PostgreSQL database tests prove two databases with colliding IDs remain isolated.
- **AC-005:** MySQL Drizzle row tests prove adapter-scoped isolation with colliding IDs and label the
  guarantee adapter-enforced/experimental.
- **AC-006:** MySQL Drizzle database tests prove two databases with colliding IDs remain isolated.
- **AC-007:** TypeORM and Sequelize each pass real-MySQL colliding-ID row and separate-database tests.
- **AC-008:** MySQL schema mode is rejected or absent and documented as database-per-tenant.
- **AC-009:** CLI detects Drizzle, TypeORM, and Sequelize and produces safe Express row-level
  boilerplate without overwriting files.
- **AC-010:** Package, root, website, architecture, security, capability, quality, and module docs agree.
- **AC-011:** Focused lanes, full `pnpm check`, package-consumer verification, website production
  build, dependency audit, and `persist doctor` pass; unavailable external lanes remain explicit.

