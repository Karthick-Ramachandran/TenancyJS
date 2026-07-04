# PRD: Isolation Strategies

## Purpose

TenancyJS began with single-database, shared-schema, row-level isolation. The owner will not launch on
that alone—teams adopt a multi-tenancy toolkit precisely for the harder isolation models. F-009 makes
TenancyJS support all three: **row-level (shared schema)**, **schema-per-tenant** (one Postgres schema per
tenant, same database), and **database-per-tenant** (one database per tenant), with honest per-adapter
capability declarations and adversarial isolation evidence for each.

## In Scope

- Core strategy model and capability matrix for all three strategies (ADR-0017).
- One shared dialect engine package and PostgreSQL schema-per-tenant implementation (ADR-0019).
- Thin Knex/Lucid schema bindings with transaction-local `search_path`, unqualified addressing,
  central-schema collision checks, and real PostgreSQL adversarial evidence.
- Later increments: database-per-tenant on Knex/Lucid/Prisma; database-enforced per-tenant roles;
  provisioning (`CREATE SCHEMA`/`CREATE DATABASE` + migrate).

## Non-Goals

- Prisma **schema-per-tenant** in the first pass — deferred to a per-schema client cache (ADR-0017).
- MongoDB. Cross-database strategies for non-PostgreSQL engines beyond what each adapter can enforce
  fail-closed.
- Domain routing / tenant registry CRUD (separate CLI work).
