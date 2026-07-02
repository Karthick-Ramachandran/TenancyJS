# PRD: Tenant Identification Testing Contracts

## Purpose

Turn raw host/header request metadata into a validated tenant-resolution outcome and provide portable
contract cases that every future integration can run against the core lifecycle.

## In Scope

- `@tenancyjs/identifiers`: ordered resolver chain, tenant-store port, typed outcomes, header, host, and
  subdomain resolvers, strict normalization, ambiguity and suspension handling.
- `@tenancyjs/testing`: immutable tenant fixtures, core manager contract cases, and a framework-neutral
  integration harness contract.
- Package builds, public exports, Changesets, consumer checks, and module memory.

## Non-Goals

- Authentication, user membership authorization, JWT verification, API-key lookup, caching, network or
  database clients, framework middleware, path resolvers, or custom-domain verification.
- Unicode/IDN conversion; applications pass punycoded ASCII hostnames.
- Choosing central mode from resolver output.
- A Vitest/Jest/Mocha runtime dependency in published testing helpers.

## Users

- Framework integrations that need consistent tenant-resolution behavior.
- Applications supplying a central tenant registry implementation.
- Adapter/integration authors running portable tenancy lifecycle conformance cases.
