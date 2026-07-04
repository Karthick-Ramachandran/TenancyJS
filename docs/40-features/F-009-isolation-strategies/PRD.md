# PRD: Isolation Strategies

## Purpose

TenancyJS ships only single-database, shared-schema, row-level isolation. The owner will not launch on
that alone — teams adopt a multi-tenancy toolkit precisely for the harder isolation models. F-009 makes
TenancyJS support all three: **row-level (shared schema)**, **schema-per-tenant** (one Postgres schema per
tenant, same database), and **database-per-tenant** (one database per tenant), with honest per-adapter
capability declarations and adversarial isolation evidence for each.

## In Scope

- Core strategy model: `TenancyStrategy` gains `schemaPerTenant`; adapter capability matrix gains
  `schemaPerTenant`; config validates all three (ADR-0017). **This foundation slice: no behavior change.**
- Later increments (each its own tests/PR): the routing/placement contract; schema-per-tenant on
  Knex/Lucid; database-per-tenant on Knex/Lucid/Prisma; provisioning (`CREATE SCHEMA`/`CREATE DATABASE` +
  migrate); per-strategy adversarial isolation tests.

## Non-Goals

- Prisma **schema-per-tenant** in the first pass — deferred to a per-schema client cache (ADR-0017).
- MongoDB. Cross-database strategies for non-PostgreSQL engines beyond what each adapter can enforce
  fail-closed.
- Domain routing / tenant registry CRUD (separate CLI work).
