# Module: Sequelize Adapter

## Purpose

Provide a callback-scoped, fail-closed stable Sequelize 6 facade over shared PostgreSQL isolation.

## Owns

- Sequelize model classification, protected plain-value CRUD/count, explicit transaction binding,
  capability metadata, validation/errors, and schema/database strategy bindings.

## Does Not Own

- Core context, shared SQL engine/cache, native model/instance/QueryInterface access, sync/migrations,
  associations, framework lifecycle, or credentials.

## Public Interfaces

- `createSequelizeTenancy`, typed config and protected model/client interfaces.

## Boundaries

Depends on core and adapter-shared; Sequelize 6.37 is a peer. PostgreSQL 17 only initially. Native ORM
objects stay private and CLS is not required. ADR-0025 is authoritative.
