# BRD: tenancyjs

## Purpose

TenancyJS reduces the time and risk involved in building multi-tenant Node.js products. It gives
teams one open-source toolkit for tenant resolution, isolation, framework integration, diagnostics,
and operations while preserving their chosen framework and data-layer workflows.

Target users are SaaS teams building on Express, Next.js, NestJS, or AdonisJS with Prisma,
Sequelize, TypeORM, Drizzle, Knex, Lucid, or Mongoose, plus platform engineers responsible for tenant
isolation and migrations.

Business success means users can adopt a tested vertical slice quickly, maintainers can support it
without a compatibility explosion, and the project earns trust through verifiable no-leak tests
rather than broad untested claims.

## Current Status

Planning. Detailed source research remains in `docs/BRD-PRD.md`; delivery scope and measurable
acceptance are in `docs/40-features/F-001-tenancyjs-platform/`.

## Success Criteria

- First supported isolation test can run within 15 minutes of starting the quickstart.
- Every stable adapter and framework slice has CI, example, and two-tenant E2E evidence.
- The project ships one secure vertical slice before expanding compatibility breadth.
- Core isolation features remain MIT-licensed and are not gated behind a hosted service.
