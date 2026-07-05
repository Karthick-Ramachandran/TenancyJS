# Module: Typeorm Adapter

## Purpose

Provide a callback-scoped, fail-closed TypeORM 1 facade over shared PostgreSQL isolation strategies.

## Owns

- TypeORM entity classification, protected repository CRUD/count, ORM invocation, transaction binding,
  capability metadata, validation/errors, and thin schema/database strategy bindings.

## Does Not Own

- Tenant context, SQL strategy implementation, raw/query-builder/Active Record access, migrations,
  provisioning, framework lifecycle, or connection credentials.

## Public Interfaces

- `createTypeOrmTenancy`, typed config and protected repository/manager interfaces.

## Boundaries

Depends on core and adapter-shared; TypeORM is a peer. Base DataSource/manager/repositories stay private.
PostgreSQL 17 only initially. ADR-0024 is authoritative.
