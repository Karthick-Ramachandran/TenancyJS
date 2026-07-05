# PRD: Mongoose Mongodb

## Purpose

Add honest MongoDB support for teams using Mongoose without pretending application-enforced document
filters equal PostgreSQL RLS. The adapter must make the safe path smaller than the native Mongoose
surface, prove it on a real replica set, and reuse core context plus the shared database-resource cache.

## In Scope

- `@tenancyjs/adapter-mongoose` for Mongoose 9.7, MongoDB 8 replica sets, and Node 24.
- Adapter-enforced row-level isolation with exhaustive model classification and protected lean CRUD.
- Database-per-tenant routing through the shared bounded cache; schema-per-tenant explicitly rejected.
- Managed session/transaction lifecycle, colliding-ID adversarial tests, docs, changeset, and package evidence.

## Non-Goals

- Native/live documents, populate, aggregation, raw collection/driver APIs, bulkWrite, mapReduce,
  change streams, schema-per-tenant, provisioning, or calling row filters database-enforced.
- Standalone Mongo transaction support, authentication/user provisioning, sharding-specific guarantees,
  or Prisma Mongo support.

## Security

The host connection and native models remain private. Protected reads return lean plain values; every
supported write composes or validates the active tenant ID and session. Unknown operations and missing
context fail before database delegation. Database-per-tenant strength depends on host credential scope
and is labeled accordingly.
