# Module Decisions: Integration Nest

Record durable module decisions here.

## Current Decisions

- ADR-0023 owns the guard/interceptor split and explicit `@TenantRoute` boundary.
- Guard-to-interceptor state is private WeakMap data, not a public request property or second ALS store.
- Authorization guards may read resolved identity; controller/service context begins in the interceptor.
- Platform-neutral request extraction supports both Nest Express and Fastify adapters.
- The optional executor controls lifecycle only; it does not inject a callback facade's protected
  client into Nest providers. TypeORM/Sequelize-style callback facades are invoked inside marked
  handlers unless the host supplies its own scoped-resource bridge.
