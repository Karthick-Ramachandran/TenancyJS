# Architecture Impact: Nest Typeorm Sequelize

## Affected Modules

- New `integration-nest`, `adapter-typeorm`, and `adapter-sequelize` packages/modules.
- Existing `core`, `identifiers`, `adapter-shared`, `testing`, CLI capability reporting, root docs, and
  package verification gain only shared contracts or metadata needed by the new packages.

## ADR Impact

- ADR-0023: Nest guard/interceptor split and Observable lifetime.
- ADR-0024: TypeORM protected repository/PostgreSQL boundary.
- ADR-0025: stable Sequelize 6 protected model/PostgreSQL boundary.

## Security Impact

Adds NestJS 11, RxJS, TypeORM 1, Sequelize 6, and PostgreSQL peer/dev dependencies. No telemetry,
runtime network service, credential ownership, auth, or production file writes. The packages execute
host-configured database work only. ORM base clients and migration APIs remain outside the boundary.

## Dependency Flow

`integration-nest -> core + identifiers` and optional structural executor;
`adapter-typeorm|adapter-sequelize -> core + adapter-shared`, with ORMs as peer dependencies. No
framework imports enter core or adapter-shared.
