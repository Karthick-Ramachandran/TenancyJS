# Architecture Impact: Nextjs Integration

## Affected Modules

- New `integration-next` module/package and private `examples/next-prisma` application.
- Existing core, identifiers, Prisma adapter, testing contracts, CLI templates, and support matrix.

## ADR Impact

- ADR-0009 accepts the Node execution, Edge hint, wrapper, streaming, and cache boundary.
- Implementation follows that accepted boundary.

## Security Impact

- Adds Next request/action and Edge-to-Node trust boundaries, but no auth, telemetry, cloud, AI/MCP,
  storage, secret-store, or integration-owned outbound network behavior.
- Next is a narrow peer; React/Next are workspace test/example dependencies.
