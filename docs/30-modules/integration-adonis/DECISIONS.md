# Module Decisions: Integration Adonis

## Current Decisions

- ADR-0014 accepts one application-scoped manager/service registered by the AdonisJS 7 provider and lexical
  request scope owned by tenant-route middleware, on the ADR-0013 Node 24 baseline.
- Resolver failure never selects central mode; central routes omit tenant middleware explicitly.
- Ace factories accept an application-injected structural shared-CLI service port under ADR-0003;
  the integration has no CLI package dependency and operational commands stay in T-10.
- Realizing ADR-0014 Decision 4 against a real app: `defineAdonisTenancyConfig` accepts the Lucid
  tenancy service either directly or as a factory `() => LucidTenancyAdapter`, resolved lazily by the
  provider at `ready()`. AdonisJS loads config before providers boot, so the Lucid database service is
  not live at config time. See [[ADONISJS_V7_COMPATIBILITY]] and `docs/60-engineering/LESSONS.md`.
- Realizing ADR-0014 Decision 3: the provider's fail-closed policy validation runs only in the `web`
  environment, so console `migration:run` and test suites can create/provision the schema the check
  requires. `run()` still refuses until `validate()` has passed.
