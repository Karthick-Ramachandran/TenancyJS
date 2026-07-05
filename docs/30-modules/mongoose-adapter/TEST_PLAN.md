# Module Test Plan: Mongoose Adapter

## Unit Tests

- Classification/config, tenant filter/data conflicts, safe plain outputs, session propagation, missing
  context, unsupported surface, errors/redaction, capabilities, and cache behavior.

## Integration Tests

- MongoDB 8 replica set row-level suite and two-database routing suite with colliding `_id` values,
  rollback, concurrency, collision, eviction, and shutdown.

## Security Tests

- No native handle escape or operator override; no tenant moves/central fallback; guarantee labels stay
  adapter-enforced unless per-database credentials provide a database authorization boundary.
