# Module Decisions: Sequelize Adapter

Record durable module decisions here.

## Current Decisions

- ADR-0025 owns stable Sequelize 6/PostgreSQL; v7 alpha is not a release target.
- Every operation receives the adapter transaction explicitly; no global CLS contract.
- Return plain values and reuse adapter-shared strategy/cache primitives.
