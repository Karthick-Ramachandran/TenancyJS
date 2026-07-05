# Review: Nest Typeorm Sequelize

## Status

Planning reviewed; implementation pending.

## Findings

- Accepted ADR-0023/0024/0025 preserve dependency direction and make security boundaries explicit.
- Sequelize 6 stable is selected over v7 alpha. PostgreSQL 17 remains the only initial SQL provider.
- Nest's guard/interceptor split reflects actual lifecycle ordering; no imperative ALS entry is used.
