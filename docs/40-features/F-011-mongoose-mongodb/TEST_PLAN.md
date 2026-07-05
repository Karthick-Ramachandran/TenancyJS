# Test Plan: Mongoose Mongodb

## Unit Tests

- Config/model classification; immutable tenant filter composition; create/update conflicts; missing/
  central context; sanitized errors; supported method delegation; unsupported surface absent; plain
  return values; capability matrix; cache collisions and lifecycle.

## Integration Tests

- MongoDB 8 replica-set two-tenant suite with identical logical `id` values covers create/find/findOne/count,
  update/delete, rollback, concurrent scopes, and session cleanup.
- Two Mongo databases with identical `_id` values prove routing; collision and eviction/close behavior
  execute through the public adapter.

## Security Tests

- No native model/document/query/collection/connection/session escape; no operator-based tenant filter
  override; no tenant move; no central fallback; resolver/factory errors sanitized; database placement
  keys never contain credentials.
