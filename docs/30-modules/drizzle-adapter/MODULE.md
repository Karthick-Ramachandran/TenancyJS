# Drizzle Adapter

## Purpose And Ownership

Own the protected Drizzle SQL facade for PostgreSQL and MySQL. The module translates canonical tenant
context into reviewed table operations while reusing shared PostgreSQL and resource-cache primitives.

## Public Interface

- `createDrizzleTenancy(options)`
- `defineDrizzleTenancyConfig(options)`
- `DRIZZLE_ADAPTER_CAPABILITIES`
- Protected client/table types and sanitized adapter errors

## Does Not Own

Tenant resolution, authentication, authorization, schema/migration generation, credentials,
provisioning, native/raw Drizzle APIs, MongoDB, or framework request lifecycle.

## Dependencies

Depends on `tenancyjs-core`, `tenancyjs-adapter-shared`, and the `drizzle-orm` peer. PostgreSQL and
MySQL driver peers are host-selected. No framework package depends on this module directly.

## Owning Feature

`docs/40-features/F-013-drizzle-mysql-support/`

