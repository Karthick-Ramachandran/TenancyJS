# `tenancyjs-adapter-shared`

Internal isolation-strategy primitives shared by TenancyJS ORM adapters. Application code should use
the public Prisma, Knex, or Lucid adapter package instead.

This package contains the single audited PostgreSQL RLS and schema-placement implementation. It does
not resolve tenants, run migrations, or expose unsafe raw-query access.

`createTenantResourceCache` provides the bounded, single-flight, reference-counted lifecycle used by
future database-per-tenant adapter bindings. It caches host-created ORM clients but never accepts or
stores connection URLs as placement keys.
