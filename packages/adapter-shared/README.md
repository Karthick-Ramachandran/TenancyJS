# `@tenancyjs/adapter-shared`

Internal isolation-strategy primitives shared by TenancyJS ORM adapters. Application code should use
the public Prisma, Knex, or Lucid adapter package instead.

This package contains the single audited PostgreSQL RLS and schema-placement implementation. It does
not create database clients, resolve tenants, run migrations, or expose unsafe raw-query access.
