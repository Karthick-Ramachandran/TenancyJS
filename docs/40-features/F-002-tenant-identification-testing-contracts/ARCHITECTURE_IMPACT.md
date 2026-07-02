# Architecture Impact: Tenant Identification Testing Contracts

## Affected Modules

- New `tenant-identifiers` and `testing-contracts` modules.
- `core-tenancy` is consumed through public exports only and is not modified semantically.
- Workspace references, package verification, README status, and F-001 T-03 evidence.

## ADR Impact

ADR-0006 defines resolver/store/outcome boundaries, precedence, and portable contract shape.

## Security Impact

Resolvers consume untrusted request metadata but perform no network, storage, auth, file writes,
telemetry, MCP, cloud, or AI behavior. Outcomes do not contain secrets. Ambiguous results omit tenant
records. Testing helpers add no runtime dependency or privileged behavior.

## Dependency Direction

`identifiers -> core` and `testing -> core`; neither module depends on a framework, ORM, or each other.
Core does not import either module.

## Configuration And Templates

No application templates are written. Resolvers are explicitly constructed and ordered in code.
