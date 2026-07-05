# Module Decisions: Mongoose Adapter

Record durable module decisions here.

## Current Decisions

- ADR-0026 owns the Mongoose 9/MongoDB protected-model and guarantee-tier boundary.
- Protected reads/writes return plain values, never live Mongoose documents.
- Schema-per-tenant is rejected; database routing reuses the shared bounded cache.
