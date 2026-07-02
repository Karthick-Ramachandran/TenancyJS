# Architecture Impact: Knex, Lucid, And AdonisJS Vertical Slice

## Affected Modules

- New `adapter-knex`, `adapter-lucid`, and `integration-adonis` packages/modules.
- New private generic Knex and Adonis/Lucid PostgreSQL reference applications.
- Existing core adapter vocabulary, shared adapter contracts, CLI templates/detection, package gate,
  support matrix, security model, and Node 22/24 PostgreSQL CI.

## Dependency Impact

- `adapter-knex` depends on core and peers on Knex 3.3; PostgreSQL is compatibility-test/example only.
- `adapter-lucid` depends on core and reviewed Knex enforcement primitives, peers on Lucid 22.4, and
  does not import the Adonis integration.
- `integration-adonis` depends on core, identifiers, and Lucid adapter and peers on AdonisJS 7.3 and
  Lucid 22.4 with Node 24. Ace factories accept a structural CLI service port; the integration does not depend on
  `@tenancyjs/cli`. Core imports none of these dependencies.
- The Adonis/Lucid packages use a dedicated Node 24 lane; framework-neutral packages retain Node 22
  and Node 24 compatibility.

## ADR Impact

- ADR-0010 accepts the PostgreSQL RLS-backed Knex/Lucid security boundary and supported operations.
- ADR-0012 accepts the AdonisJS 7 provider, middleware, Japa, Ace, and compatibility contract and
  replaces ADR-0010's Lucid 21.8 version clauses.

## Config And Template Impact

- Add typed adapter and integration config with explicit table/model classification and one fixed,
  validated PostgreSQL setting namespace.
- Extend safe CLI detection/templates for Adonis/Lucid through `ProjectChangePlan`; no direct project
  writes, overwrite mode, `.env` reads, or shell commands are added.
- RLS policy DDL remains an application-owned reviewed migration generated as a template; runtime code
  validates policy presence but never mutates schema automatically.

## Security Impact

- Adds database storage, transaction, application-role, RLS-policy, framework lifecycle, and package
  supply-chain boundaries. It adds no telemetry, cloud, MCP, AI API, remote template, or runtime
  network behavior beyond host-supplied PostgreSQL access.
- The guarantee applies only to protected clients/models inside the documented transaction boundary.
  Retained Knex/Lucid base services, privileged database roles, disabled/unforced policies, and
  unsupported operations remain outside the guarantee and must fail validation or be documented.
