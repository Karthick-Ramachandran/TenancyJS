# Module: Mongoose Adapter

## Purpose

Provide a narrow, callback-scoped Mongoose 9 isolation facade with honest adapter-enforced MongoDB
row filtering and bounded database routing.

## Owns

- Model classification, protected lean CRUD/count, tenant filter/data policy, managed transaction
  session binding, database resource-cache binding, capabilities, validation, errors, and docs.

## Does Not Own

- Native model/document/query/collection/connection/session exposure, aggregation/populate/raw driver,
  authentication/users, provisioning, or framework lifecycle.

## Public Interfaces

- `createMongooseTenancy`, typed configuration, protected model/client interfaces, and database resource
  placement types.

## Boundaries

Depends on core and adapter-shared; Mongoose 9.7 is a peer. Row-level requires a MongoDB replica set for
managed transactions and remains adapter-enforced. ADR-0026 is authoritative.
