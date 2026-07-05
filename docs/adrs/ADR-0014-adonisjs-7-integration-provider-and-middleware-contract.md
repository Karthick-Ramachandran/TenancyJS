# ADR-0014: AdonisJS 7 Integration Provider And Middleware Contract

## Status

Accepted

## Supersedes

- The AdonisJS 7 integration decisions of ADR-0013 (its Decisions 3 through 13): the separate
  `tenancyjs-integration-adonis` package boundary and its AdonisJS 7.3 / Lucid 22.4 peer target,
  `defineAdonisTenancyConfig`, the provider lifecycle, the tenant middleware, the sanitized error
  mapping, tenant-route explicitness, the Japa helper/plugin, the Ace command factories, the safe CLI
  init templates, the v6-to-v7 compatibility fixture, and the PostgreSQL 17 Adonis/Lucid isolation
  clause. ADR-0013's Node 24 engine and CI baseline (its Decisions 1 and 2) remain accepted and are
  not superseded.
- This continues the lineage ADR-0011 then ADR-0012 then ADR-0013. ADR-0014 is now the single accepted
  home of the AdonisJS 7 provider, middleware, and testing contract.

## Context

ADR-0013 was accepted to set Node.js 24 as the one repository-wide engine and CI baseline. Because it
superseded ADR-0012 wholesale, it also re-stated the entire AdonisJS 7 integration contract inside its
own decision list. That conflated two unrelated concerns: a runtime baseline that applies to every
package, and an integration-specific provider/middleware/testing contract that applies only to
`tenancyjs-integration-adonis`. The result forced integration and module memory to cite a Node
baseline ADR for provider lifecycle and middleware decisions, which is structurally confusing and
makes the accepted Adonis contract hard to locate and evolve.

`tenancyjs-integration-adonis` (F-007 task T5) has not been implemented yet, so extracting the
integration contract into its own ADR now — before code is written against it — restores
one-decision-per-ADR clarity at the lowest cost. No decision content changes; only its home does. The
partial extraction follows the repository's established precedent, where ADR-0012 superseded only
specific decisions of ADR-0010 while ADR-0010 itself stayed accepted.

## Decision

1. Publish `tenancyjs-integration-adonis` separately. It targets AdonisJS `>=7.3.0 <8` and Lucid
   `>=22.4.0 <23`, declares Node `>=24` (inheriting the ADR-0013 baseline), and depends inward on core,
   identifiers, and the Lucid adapter. It imports no CLI package, base Knex client, or application model.
2. Expose typed `defineAdonisTenancyConfig` for one application-owned manager, resolver, Lucid tenancy
   service, error mapping, and middleware options. Config contains no credentials, creates no hidden
   database client, and never infers central routes or duplicates model classification.
3. The AdonisJS 7 provider registers stable IoC bindings during `register`, validates adapter policy
   during `boot`/`ready`, and releases only integration-owned resources during shutdown. It follows
   current Adonis provider and `adonisrc.ts` hook conventions.
4. Tenant middleware copies a frozen host/header snapshot from `HttpContext`, resolves exactly once,
   enters `TenancyManager.runWithTenant` only for `resolved`, then enters the Lucid managed transaction
   around `await next()`. Any resolution, handler, transaction, or cleanup failure rolls back/releases.
5. Missing/invalid identity maps to sanitized 400, unknown/suspended to the same sanitized 404, and
   ambiguous registry state to sanitized 500. Resolver failure never becomes central context.
6. Tenant middleware is explicit on tenant route groups. Central routes omit it or enter explicit core
   central scope through application-owned code. Work spawned or streamed after middleware settlement is
   outside the supported database lifetime.
7. Export a Japa helper/plugin using the same manager/Lucid service. Stable evidence uses AdonisJS 7's
   Japa plugin and API client plus a compiled production application — not framework mocks alone.
8. Export thin Ace command factories only for operations already owned by the shared CLI. They accept an
   application-injected structural service port and never duplicate file writes, migration, seed, or
   tenant iteration.
9. Safe CLI init emits AdonisJS 7-native provider, middleware, config, imports, model/migration, and
   test files through `ProjectChangePlan`. It remains preview-first, conflict-aware, contained,
   symlink-safe, idempotent, secret-safe, and shell-free.
10. Maintain an isolated v6-to-v7 compatibility fixture/checklist derived from the supplied upgrade
    procedure. It verifies generated files use v7 names and layout. Never run its npm `--force` command
    against this monorepo or silently upgrade a user's project.
11. Initial Adonis/Lucid isolation remains PostgreSQL 17 under ADR-0010. Other SQL providers require
    their own enforceable boundary and real-database evidence; framework support does not imply
    database-provider support.

## Alternatives Considered

- Leave the Adonis contract embedded in ADR-0013: rejected because it conflates a repository-wide
  runtime baseline with an integration-specific contract, forcing integration and module memory to cite
  a Node ADR for provider lifecycle and middleware decisions.
- Fully supersede ADR-0013 and split it into two new ADRs: rejected because it would retire the
  still-valid Node 24 baseline decision, churn its number, and invalidate every baseline reference; a
  partial extraction matches the ADR-0010 precedent and keeps the audit trail cheaper.
- Rewrite or renumber ADR-0013 in place: rejected because an accepted decision is never overwritten;
  supersession preserves the reasoning trail.

## Consequences

The repository regains one decision per ADR: ADR-0013 is the pure Node 24 engine and CI baseline, and
ADR-0014 is the AdonisJS 7 integration contract. Integration and module memory cite ADR-0014 for the
provider, middleware, config, error mapping, Japa, Ace, CLI templates, and Adonis/Lucid isolation, and
cite ADR-0013 only for the runtime floor.

No runtime behavior changes. F-007 task T5 now implements against ADR-0014. The streaming and
long-running handler limits and the PostgreSQL-17-only Adonis/Lucid isolation carry forward unchanged.
ADR-0012 remains superseded; its contract now lives, extracted and standalone, in ADR-0014.

## Related Documents

- PRD: `docs/00-product/PRD.md`
- Architecture: `docs/10-architecture/ARCHITECTURE.md`
- Security: `docs/20-security/SECURITY_MODEL.md`
- Feature: `docs/40-features/F-007-knex-lucid-adonis/`
- Modules: `docs/30-modules/integration-adonis/`, `docs/30-modules/lucid-adapter/`
- Node 24 baseline: `docs/adrs/ADR-0013-nodejs-24-and-adonisjs-7-support-baseline.md`
- Prior decisions in lineage: `docs/adrs/ADR-0012-adonisjs-7-provider-middleware-and-testing-contract.md`,
  `docs/adrs/ADR-0011-adonis-provider-middleware-and-testing-contract.md`
- Adonis service providers: `https://docs.adonisjs.com/guides/concepts/service-providers`
- Adonis upgrade guide: `https://docs.adonisjs.com/guides/upgrade-guides/v6-to-v7`
