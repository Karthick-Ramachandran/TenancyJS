# Module Decisions: Integration Adonis

## Current Decisions

- ADR-0014 accepts one application-scoped manager/service registered by the AdonisJS 7 provider and lexical
  request scope owned by tenant-route middleware, on the ADR-0013 Node 24 baseline.
- Resolver failure never selects central mode; central routes omit tenant middleware explicitly.
- Ace factories accept an application-injected structural shared-CLI service port under ADR-0003;
  the integration has no CLI package dependency and operational commands stay in T-10.
