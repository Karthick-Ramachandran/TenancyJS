# Architecture Impact: Mongoose Mongodb

## Affected Modules

- New `adapter-mongoose` package/module depending on core and adapter-shared.
- Testing/capability/docs/pack-check gain Mongoose coverage; SQL adapters and core stay database-neutral.

## ADR Impact

- ADR-0026 defines the protected model facade, guarantee tier, replica-set transaction requirement, and
  database-routing boundary. No accepted initial-scope ADR is contradicted; the earlier PRD exclusion
  was explicitly limited to the initial commitment.

## Security Impact

Adds Mongoose 9/MongoDB driver dev and peer dependencies and executes host-configured Mongo operations.
No telemetry, hosted service, runtime outbound service, credential ownership, production file writes,
or auth policy. Real tests require an ephemeral local replica set.
