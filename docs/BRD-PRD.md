# TenancyJS — Business Requirements Document (BRD) & Product Requirements Document (PRD)

| Field | Value |
|-------|--------|
| **Product name** | TenancyJS (working title) |
| **Document version** | 1.0.0 |
| **Last updated** | 2026-06-29 |
| **Status** | Draft for implementation |
| **License target** | MIT (100% open source — no gated core features) |
| **Primary distribution** | npm packages + `tenancy` CLI |
| **Repository model** | Single monorepo (concentrate stars, issues, and maintenance) |

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Business context & motivation](#2-business-context--motivation)
3. [Problem statement](#3-problem-statement)
4. [Inspirations & competitive landscape](#4-inspirations--competitive-landscape)
5. [Vision, mission, and principles](#5-vision-mission-and-principles)
6. [Target users & personas](#6-target-users--personas)
7. [Business goals & success metrics](#7-business-goals--success-metrics)
8. [Product scope](#8-product-scope)
9. [Tenancy models & isolation strategies](#9-tenancy-models--isolation-strategies)
10. [Functional requirements](#10-functional-requirements)
11. [Non-functional requirements](#11-non-functional-requirements)
12. [System architecture](#12-system-architecture)
13. [Package & monorepo structure](#13-package--monorepo-structure)
14. [Core API specification](#14-core-api-specification)
15. [Tenant identification](#15-tenant-identification)
16. [Bootstrappers](#16-bootstrappers)
17. [Event system](#17-event-system)
18. [ORM adapter requirements](#18-orm-adapter-requirements)
19. [Framework integration requirements](#19-framework-integration-requirements)
20. [Next.js-specific requirements](#20-nextjs-specific-requirements)
21. [AdonisJS-specific requirements](#21-adonisjs-specific-requirements)
22. [CLI specification](#22-cli-specification)
23. [Configuration & environment](#23-configuration--environment)
24. [Central vs tenant application contexts](#24-central-vs-tenant-application-contexts)
25. [Database & MongoDB requirements](#25-database--mongodb-requirements)
26. [Background jobs & queues](#26-background-jobs--queues)
27. [Caching, storage, and Redis](#27-caching-storage-and-redis)
28. [Security & compliance](#28-security--compliance)
29. [Testing strategy](#29-testing-strategy)
30. [Documentation & developer experience](#30-documentation--developer-experience)
31. [Release, versioning, and governance](#31-release-versioning-and-governance)
32. [Phased delivery roadmap](#32-phased-delivery-roadmap)
33. [Risks & mitigations](#33-risks--mitigations)
34. [Open questions & decisions log](#34-open-questions--decisions-log)
35. [Appendices](#35-appendices)

---

## 1. Executive summary

**TenancyJS** is an open-source, TypeScript-first multi-tenancy platform for the Node.js ecosystem. It provides:

- A **framework-agnostic core** (tenant context, identification, lifecycle events, bootstrappers).
- **ORM adapters** for the most common Node data layers (Prisma, Sequelize, Mongoose, Knex, Drizzle, TypeORM, and extensibility for others).
- **Framework integrations** including Express, Fastify, NestJS, **Next.js** (App Router & Pages), and **AdonisJS**.
- A **single CLI** (`tenancy`) to initialize projects, scaffold config, run tenant migrations, and operate tenant lifecycles.

The product is explicitly inspired by **[Tenancy for Laravel](https://tenancyforlaravel.com/)** (`stancl/tenancy`): automatic tenancy bootstrapping, event-driven provisioning, high testability, and optional database-per-tenant — but implemented with Node primitives (`AsyncLocalStorage`, middleware, adapter pattern) rather than PHP/Laravel coupling.

Unlike the Laravel ecosystem’s commercial split (free MIT package + paid SaaS boilerplate), **all tenancy engine features described in this document are MIT and npm-installable**. Optional future application templates (billing UI, domain admin) may exist as separate repos and are **out of scope** for this PRD’s core product.

---

## 2. Business context & motivation

### 2.1 Community outcome

- Reduce repeated, error-prone custom multi-tenant implementations in Node SaaS products.
- Prevent cross-tenant data leaks through **fail-closed defaults** and tested adapters.
- Offer Laravel-grade tenancy ergonomics to teams on **Next.js**, **AdonisJS**, and generic Node stacks.

### 2.2 Maintainer outcome (win-win)

- **Single monorepo + CLI** concentrates GitHub stars, npm downloads, and reputation in one link.
- Establishes the author as a visible maintainer in a high-value problem space (SaaS infrastructure).
- Creates opportunities via OSS credibility (hiring, consulting, sponsorship) without paywalling the engine.

### 2.3 Market timing

- AI tooling accelerates feature delivery; **infrastructure correctness** (tenant isolation, migrations, tests) becomes a sharper differentiator for engineers.
- AdonisJS has **no official multi-tenancy package**; Node has **no dominant `stancl/tenancy` equivalent**.
- MongoDB SaaS and SQL SaaS both need first-class support.

---

## 3. Problem statement

### 3.1 Current pain

| Pain | Description |
|------|-------------|
| **Fragmentation** | Each team rebuilds subdomain routing, `tenantId` scoping, and migration loops. |
| **Leak risk** | Raw queries, forgotten `where tenantId`, jobs without tenant context cause incidents. |
| **ORM heterogeneity** | Prisma, Sequelize, Mongoose, Drizzle, TypeORM, Knex/Lucid each need different hooks. |
| **Framework heterogeneity** | Next.js server actions, Route Handlers, and middleware differ from Express/Adonis. |
| **Testing** | Hard to test central vs tenant paths; few libraries document tenant test harnesses. |
| **Laravel → Node migrants** | Expect Tenancy-for-Laravel-style “automatic mode”; Node rarely delivers parity. |

### 3.2 What success looks like

A developer runs:

```bash
npm install tenancyjs-core tenancyjs-cli
npx tenancyjs-cli init
```

…and within minutes has tenant resolution, isolated ORM access, CLI migration commands, and tests proving tenant A cannot read tenant B’s data — on their chosen stack (including Next.js or AdonisJS).

---

## 4. Inspirations & competitive landscape

### 4.1 Primary inspiration: Tenancy for Laravel (`stancl/tenancy`)

**Source:** [tenancyforlaravel.com](https://tenancyforlaravel.com/) · [github.com/archtechx/tenancy](https://github.com/archtechx/tenancy)

Concepts to port (not PHP APIs):

| Laravel / stancl concept | TenancyJS equivalent |
|--------------------------|----------------------|
| Automatic tenancy | Default connection / scope switched via bootstrappers after `initialize()` |
| Manual tenancy | Explicit connection or scope per model/query |
| Multi-database tenancy | Database-per-tenant provisioning + per-tenant migration runner |
| Single-database tenancy | Row-level `tenantId` + global scopes / query extensions |
| PostgreSQL schema mode | Schema-per-tenant bootstrapper (Postgres only) |
| Domain / subdomain identification | `TenantResolver` plugins + middleware |
| Event system | Typed `TenancyEvents` |
| Tenant created → migrate DB | `tenant.created` pipeline |
| Bootstrappers: DB, cache, FS, queue | Bootstrapper registry (phased) |
| Resource syncing across tenant DBs | `ResourceSync` module (post-v1) |
| User impersonation | `Impersonation` module (post-v1) |
| Artisan: `tenants:migrate` | CLI: `tenancy migrate` |
| High testability | `tenancyjs-testing` helpers |

**Laravel commercial model (for awareness, not replication):**

- **Free:** `stancl/tenancy` (MIT).
- **Paid:** SaaS boilerplate (~$199–$379 one-time), consulting, audits — **application shell**, not core tenancy.
- **TenancyJS decision:** core engine remains fully OSS; no feature gating.

### 4.2 Secondary inspirations

| Project | Take inspiration from |
|---------|------------------------|
| **BoringNode** ([github.com/boringnode](https://github.com/boringnode)) | Framework-agnostic package first, thin framework adapter second (Adonis team pattern). |
| **AdonisJS** ([adonisjs.com](https://adonisjs.com)) | Provider + middleware + Ace commands + Japa testing integration. |
| **VineJS / standard-schema** | Validator-agnostic patterns; avoid locking to one schema library in core. |
| **AsyncLocalStorage (Node)** | Request-scoped tenant context without parameter drilling. |

### 4.3 Competitors & references (Node)

| Name | Notes |
|------|--------|
| Community `@saaskit/multitenancy-*` (npm/GitHub) | Framework-agnostic marketing; evaluate for API ideas, differentiate on testability + Laravel parity + CLI. |
| `smickelbeard/adonis-multitenancy` | Adonis-specific; v7 compatibility varies. |
| `Arcoders/Adonisjs-lasagna-saas-tenancy` | Schema-based PostgreSQL for Adonis v7. |
| Roll-your-own middleware + `tenantId` | Default “competitor” for most teams. |

**Positioning statement:**

> TenancyJS is the open-source, TypeScript-first multi-tenancy platform for Node.js — inspired by Tenancy for Laravel, with first-class Next.js and AdonisJS integrations and adapters for every major ORM.

---

## 5. Vision, mission, and principles

### 5.1 Vision

Every Node SaaS can adopt safe multi-tenancy in hours, not weeks, with one CLI and one mental model.

### 5.2 Mission

Ship a **monorepo** of MIT packages and a **CLI** that implements automatic/manual tenancy, comprehensive ORM adapters, and framework integrations — with documentation and tests that treat **data isolation** as a first-class feature.

### 5.3 Product principles

1. **Open source core** — MIT; no paid tier for isolation, identification, or migration CLI.
2. **One repo, one star gravity** — monorepo; avoid adapter repo sprawl early.
3. **Fail closed** — missing tenant context should error in strict mode (configurable).
4. **Adapter pattern** — core knows nothing about Prisma/Mongoose internals.
5. **Laravel familiarity** — naming and docs echo stancl where it helps migrants.
6. **TypeScript-first** — inferred types for tenant id, config, and adapter options.
7. **Testability** — central app, tenant app, and registration flow must be testable.
8. **Progressive complexity** — row-level first; database-per-tenant second; schema-per-tenant third.

---

## 6. Target users & personas

| Persona | Needs |
|---------|--------|
| **SaaS founder (Next.js)** | Subdomain tenants, Prisma/Drizzle, Stripe later; fast MVP. |
| **Laravel migrant (AdonisJS)** | Same mental model as `stancl/tenancy`; Lucid ORM. |
| **Backend engineer (Express/Nest)** | Header/JWT tenant for APIs; Sequelize or Prisma. |
| **MongoDB SaaS builder** | Mongoose plugin; optional DB-per-tenant on Mongo. |
| **Platform engineer** | DB-per-tenant provisioning, migration loops, observability hooks. |
| **OSS contributor** | Clear adapter interface, good-first-issues, documented RFC process. |

---

## 7. Business goals & success metrics

### 7.1 Business goals (12 months)

| Goal | Target (indicative) |
|------|---------------------|
| GitHub stars (monorepo) | 1,000+ (launch spike + steady growth) |
| npm weekly downloads (core) | 5,000+ |
| Production adopters (self-reported) | 10+ companies in README wall |
| Framework coverage | Next.js + Adonis + Express documented as “stable” |
| ORM adapters (stable) | Prisma, Mongoose, Sequelize, Knex minimum |

### 7.2 Product metrics

- Time-to-first-isolated-query after `tenancyjs-cli init` < **15 minutes** (documented quickstart).
- Zero cross-tenant reads in adapter integration test suite.
- CLI success rate for `init` on supported stacks > **95%** (telemetry opt-in later).

### 7.3 Non-goals for reputation

- Stars without maintenance depth (avoid huge broken promises in README).
- Paywalling security features (strict mode, leak detection always free).

---

## 8. Product scope

### 8.1 In scope (core product)

- `tenancyjs-core` — context, config, events, bootstrappers, tenant registry.
- `tenancyjs-cli` — init, migrate, seed, list, run.
- ORM adapters (prioritized list in §18).
- Framework integrations: **Next.js**, **AdonisJS**, Express, Fastify, NestJS.
- Identification: domain, subdomain, header, path, JWT, custom resolver.
- Strategies: row-level, database-per-tenant, schema-per-tenant (Postgres).
- Central vs tenant execution contexts.
- `tenancyjs-testing` — harness for unit/integration/e2e.
- Documentation site + example applications.

### 8.2 Out of scope (core repo)

- Billing (Stripe/Paddle), invoicing, plan management UI.
- Customer-facing domain DNS/SSL automation (cf. Laravel boilerplate Ploi integration).
- Admin dashboard / Nova equivalent (may be separate optional template repo).
- Hosted SaaS platform (multi-tenant hosting as a service).
- Non-Node runtimes (Bun/Deno **best-effort** compatibility, not v1 commitment).

### 8.3 Future / optional separate repos

- `tenancyjs/saas-starter-next` — Next + Prisma + billing (like Laravel paid boilerplate).
- `tenancyjs/saas-starter-adonis` — Adonis + Lucid + Inertia.

---

## 9. Tenancy models & isolation strategies

### 9.1 Strategy matrix

| Strategy | Isolation | SQL | MongoDB | Complexity | v1 priority |
|----------|-----------|-----|---------|------------|-------------|
| **Row-level** (`tenantId`) | Logical | Yes | Yes | Low | **P0** |
| **Database-per-tenant** | Physical DB | Yes | Yes (`useDb`/separate DB) | High | **P1** |
| **Schema-per-tenant** | Postgres schema | Postgres only | N/A | Medium | **P2** |

### 9.2 Central database

Always required for:

- `tenants` table/collection
- `domains` / `tenant_domains` (hostname → tenant mapping)
- Optional: `tenant_users`, plans, feature flags (central-only)

Tenant-specific application data lives per strategy (shared tables with `tenantId` vs separate DBs).

### 9.3 Tenant record (minimum fields)

```ts
type TenantRecord = {
  id: string // uuid/cuid
  name: string
  slug: string // subdomain key
  status: 'active' | 'suspended' | 'provisioning' | 'deleted'
  strategy: 'rowLevel' | 'databasePerTenant' | 'schemaPerTenant'
  databaseUrl?: string // encrypted at rest when set
  schemaName?: string
  createdAt: Date
  updatedAt: Date
}
```

### 9.4 Domain mapping

```ts
type TenantDomain = {
  id: string
  tenantId: string
  domain: string // FQDN or subdomain label policy
  isPrimary: boolean
  verifiedAt?: Date
}
```

---

## 10. Functional requirements

### 10.1 Core tenancy lifecycle

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-C-01 | Initialize tenancy for a resolved tenant within a request/job scope | P0 |
| FR-C-02 | End tenancy and revert bootstrappers in `finally` semantics | P0 |
| FR-C-03 | `runWithTenant(tenant, fn)` for tests and scripts | P0 |
| FR-C-04 | `runInCentralContext(fn)` bypassing tenant scopes | P0 |
| FR-C-05 | Strict mode: throw if tenant-aware adapter used without context | P0 |
| FR-C-06 | Support multiple concurrent tenants only via isolated async contexts (no global mutable tenant) | P0 |
| FR-C-07 | Tenant suspension: block initialization or read-only mode | P1 |
| FR-C-08 | Tenant provisioning pipeline on create (async jobs) | P1 |

### 10.2 Identification

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-I-01 | Subdomain resolution (`acme.app.com` → tenant `acme`) | P0 |
| FR-I-02 | Full domain resolution (`acme.com` custom domain) | P0 |
| FR-I-03 | Header resolution (`X-Tenant-Id`, configurable) | P0 |
| FR-I-04 | Path prefix resolution (`/t/:tenantId/...`) | P1 |
| FR-I-05 | JWT claim resolution (`tenantId` claim) | P1 |
| FR-I-06 | API key → tenant mapping (custom resolver hook) | P2 |
| FR-I-07 | Central domain allowlist (no tenant on `app.com`, `www`) | P0 |
| FR-I-08 | Cached tenant lookup with TTL | P1 |

### 10.3 ORM isolation

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-O-01 | Row-level: auto-filter reads/updates/deletes by `tenantId` | P0 |
| FR-O-02 | Row-level: auto-set `tenantId` on create | P0 |
| FR-O-03 | Configurable tenant field name (default `tenantId`) | P0 |
| FR-O-04 | Central model allowlist excluded from scoping | P0 |
| FR-O-05 | Database-per-tenant: switch connection per initialization | P1 |
| FR-O-06 | Schema-per-tenant: set search_path / schema | P2 |
| FR-O-07 | Support transactions with correct tenant context | P0 |
| FR-O-08 | Document and detect unsafe raw SQL | P1 |

### 10.4 Tenant operations (CLI)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-CLI-01 | `tenancyjs-cli init` — scaffold config and integration files | P0 |
| FR-CLI-02 | `tenancy list` — list tenants | P0 |
| FR-CLI-03 | `tenancy migrate` — migrate all tenants (DB-per-tenant) | P1 |
| FR-CLI-04 | `tenancy migrate --tenant=<id>` | P1 |
| FR-CLI-05 | `tenancy seed` | P1 |
| FR-CLI-06 | `tenancy run <script>` — run in tenant context | P1 |
| FR-CLI-07 | `tenancy make:tenant` (dev helper) | P2 |

### 10.5 Events & hooks

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-E-01 | Emit lifecycle events (see §17) | P0 |
| FR-E-02 | Register listeners in config or code | P0 |
| FR-E-03 | Pipeline for `tenant.created` (create DB, migrate, seed) | P1 |

### 10.6 Advanced (stancl parity — post-v1)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-A-01 | Resource syncing between tenant databases | P2 |
| FR-A-02 | User impersonation (central → tenant) | P2 |
| FR-A-03 | Cross-tenant user membership (central index) | P2 |
| FR-A-04 | Tenant-aware queue payload envelope | P1 |

---

## 11. Non-functional requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-01 | Performance | Tenant resolution + init overhead < 5ms p95 (excl. cache miss DB hit) |
| NFR-02 | Performance | ALS context access O(1); no per-request heavy reflection |
| NFR-03 | Security | No tenant id in logs by default; secrets via env |
| NFR-04 | Reliability | Bootstrapper revert always runs on error paths |
| NFR-05 | Compatibility | Node.js 20+ LTS minimum |
| NFR-06 | TypeScript | Strict TS; public APIs fully typed |
| NFR-07 | ESM | ESM-first packages (`"type": "module"`) |
| NFR-08 | Tree-shaking | Adapters as separate packages |
| NFR-09 | CI | Unit + integration tests per adapter on every PR |
| NFR-10 | Docs | Every public API documented with examples |

---

## 12. System architecture

### 12.1 High-level diagram

```text
                    ┌─────────────────────────────────────┐
                    │           Application               │
                    │  (Next.js / Adonis / Express / …)   │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │   Framework integration layer      │
                    │   middleware / hooks / providers   │
                    └─────────────────┬───────────────────┘
                                      │
          ┌───────────────────────────▼───────────────────────────┐
          │                    tenancyjs-core                     │
          │  Resolvers → TenancyManager → Bootstrappers → Events   │
          │           AsyncLocalStorage TenantContext              │
          └───────────────────────────┬───────────────────────────┘
                                      │
        ┌─────────────┬───────────────┼───────────────┬─────────────┐
        ▼             ▼               ▼               ▼             ▼
   adapter-      adapter-       adapter-       adapter-     adapter-
   prisma        mongoose       sequelize      knex         drizzle
        │             │               │               │             │
        └─────────────┴───────────────┴───────────────┴─────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │   Central DB + Tenant datastore(s)   │
                    │   PostgreSQL / MySQL / MongoDB / …     │
                    └───────────────────────────────────────┘
```

### 12.2 Request flow (automatic mode)

1. HTTP request enters framework middleware.
2. Resolver chain extracts hostname/header/JWT → `tenantId`.
3. Load tenant from central store (cache optional).
4. `tenancy.initialize(tenant)` runs bootstrappers.
5. Application code runs (ORM automatically scoped).
6. `tenancy.end()` reverts bootstrappers in `finally`.

### 12.3 Job flow

1. Producer enqueues job with `{ tenantId, ...payload }`.
2. Worker wraps handler with `runWithTenant(tenant)`.
3. Same bootstrappers as HTTP.

---

## 13. Package & monorepo structure

### 13.1 Repository layout

```text
tenancyjs/
  packages/
    core/
    identifiers/
    bootstrappers-database/
    bootstrappers-cache/          # P1
    bootstrappers-storage/        # P1
    bootstrappers-queue/          # P1
    adapter-prisma/
    adapter-mongoose/
    adapter-sequelize/
    adapter-knex/
    adapter-drizzle/              # P1
    adapter-typeorm/              # P2
    adapter-mikroorm/             # P3
    integration-next/
    integration-adonis/
    integration-express/
    integration-fastify/
    integration-nest/
    testing/
    cli/
  examples/
    next-prisma/
    next-drizzle/
    adonis-lucid/
    express-mongoose/
    nest-prisma/
  docs/
  BRD-PRD.md
```

### 13.2 npm naming (recommended)

| Package | Purpose |
|---------|---------|
| `tenancyjs-core` | Core engine |
| `tenancyjs-cli` | CLI binary `tenancy` |
| `tenancyjs-identifiers` | Built-in resolvers |
| `tenancyjs-adapter-*` | ORM plugins |
| `tenancyjs-integration-*` | Framework wiring |
| `tenancyjs-testing` | Test utilities |

Optional meta package:

- `tenancyjs-tenancy` — re-exports core + docs pointer (no logic).

### 13.3 Versioning

- **Changesets** for synchronized semver across packages.
- Adapters major-bump when peer dependency ranges break (e.g. Prisma 6 → 7).

---

## 14. Core API specification

### 14.1 TenancyManager

```ts
interface TenancyManager {
  initialize(tenant: TenantRecord): Promise<void>
  end(): Promise<void>
  getTenant(): TenantRecord | null
  getTenantOrFail(): TenantRecord
  isInitialized(): boolean
  runWithTenant<T>(tenant: TenantRecord, fn: () => Promise<T>): Promise<T>
  runInCentralContext<T>(fn: () => Promise<T>): Promise<T>
}
```

### 14.2 Configuration file (`tenancy.config.ts`)

```ts
import { defineConfig } from 'tenancyjs-core'

export default defineConfig({
  strategy: 'rowLevel', // | 'databasePerTenant' | 'schemaPerTenant'
  mode: 'automatic', // | 'manual'
  strict: true,
  tenantIdField: 'tenantId',
  centralModels: ['Tenant', 'TenantDomain', 'User'], // adapter-specific mapping
  centralDomains: ['localhost', 'app.example.com'],
  identification: {
    resolvers: [
      { type: 'subdomain', centralDomain: 'app.example.com' },
      { type: 'header', header: 'x-tenant-id' },
    ],
  },
  bootstrappers: ['database'],
  database: {
    centralUrl: process.env.DATABASE_URL,
    tenantConnectionTemplate: process.env.TENANT_DATABASE_URL_TEMPLATE,
  },
  events: './tenancy.events.ts',
})
```

### 14.3 Adapter registration

```ts
import { registerAdapter } from 'tenancyjs-core'
import { prismaAdapter } from 'tenancyjs-adapter-prisma'

registerAdapter(prismaAdapter({ prisma, tenantScopedModels: ['Post', 'Order'] }))
```

---

## 15. Tenant identification

### 15.1 Resolver interface

```ts
interface TenantResolver {
  id: string
  resolve(input: ResolverInput): Promise<TenantRecord | null>
}

type ResolverInput = {
  host?: string
  path?: string
  headers: Record<string, string | string[] | undefined>
  jwtPayload?: Record<string, unknown>
}
```

### 15.2 Next.js considerations

- Use `middleware.ts` for host-based resolution on Edge (limited DB — see §20).
- Prefer JWT or header tenant in Edge; central lookup in Node server routes.
- Document split between **Edge** (token/slug only) vs **Node** (full central DB lookup).

### 15.3 Failure behavior

| Case | Behavior |
|------|----------|
| Unknown domain | 404 or redirect to central marketing site |
| Suspended tenant | 403 with code `TENANT_SUSPENDED` |
| Central domain | `runInCentralContext` — no tenant scope |

---

## 16. Bootstrappers

### 16.1 Interface

```ts
interface TenancyBootstrapper {
  id: string
  bootstrap(tenant: TenantRecord): Promise<void>
  revert(): Promise<void>
}
```

### 16.2 Database bootstrapper (P0/P1)

| Strategy | bootstrap | revert |
|----------|-----------|--------|
| rowLevel | Set ALS tenant id only | Clear ALS |
| databasePerTenant | Point ORM to tenant connection | Restore central/default |
| schemaPerTenant | `SET search_path` / equivalent | Reset path |

### 16.3 Cache bootstrapper (P1)

- Prefix: `tenant:{id}:` for Redis keys or cache tags.
- In-memory cache: forbid global singleton without prefix in strict docs.

### 16.4 Storage bootstrapper (P1)

- Prefix object keys: `tenants/{id}/...` (S3/R2/local).

### 16.5 Queue bootstrapper (P1)

- Inject `tenantId` metadata into job serialization standard.

---

## 17. Event system

### 17.1 Event catalog

| Event | When |
|-------|------|
| `tenancy.resolving` | Before resolver chain |
| `tenancy.resolved` | Tenant found (or null) |
| `tenancy.initializing` | Before bootstrappers |
| `tenancy.initialized` | After bootstrappers |
| `tenancy.ending` | Before revert |
| `tenancy.ended` | After revert |
| `tenant.creating` | Before central record insert |
| `tenant.created` | After central record insert |
| `tenant.provisioning` | Start async provision |
| `tenant.provisioned` | DB ready |
| `tenant.suspended` | Status change |
| `tenant.deleted` | Soft/hard delete |

### 17.2 Default listener: provision tenant database (P1)

On `tenant.created` when `strategy === 'databasePerTenant'`:

1. Create database (or schema).
2. Run migrations.
3. Optional seed.
4. Mark tenant `active`.

---

## 18. ORM adapter requirements

### 18.1 Adapter interface

```ts
interface OrmTenancyAdapter {
  readonly name: string
  register(config: OrmAdapterConfig): void
  applyRowLevelTenancy(options: RowLevelOptions): void
  applyDatabasePerTenant?(options: DbPerTenantOptions): Promise<void>
  validateSetup(): Promise<AdapterValidationResult>
}
```

### 18.2 Priority tiers

| Tier | ORM | SQL/NoSQL | Priority |
|------|-----|-----------|----------|
| T0 | **Prisma** | SQL (+ Mongo preview if applicable) | P0 |
| T0 | **Mongoose** | MongoDB | P0 |
| T0 | **Sequelize** | SQL | P0 |
| T1 | **Knex** | SQL | P1 (Adonis Lucid path) |
| T1 | **Drizzle** | SQL | P1 (Next.js popularity) |
| T2 | **TypeORM** | SQL | P2 |
| T3 | **MikroORM** | SQL | P3 |
| T3 | **Objection.js** | SQL | P3 |
| Ext | **Custom** | Document adapter RFC | ongoing |

### 18.3 Per-adapter acceptance criteria (row-level)

- `find*` never returns rows with different `tenantId`.
- `create` always sets current `tenantId`.
- `update/delete` cannot affect other tenants’ rows.
- `count/aggregate` scoped.
- Bypass only via `runInCentralContext` or explicit `unsafeBypass` API (logged in strict mode).

### 18.4 Prisma-specific

- Use Client Extensions (`$extends`) for query interception.
- Document relation traversals and nested writes.
- Separate generated clients for central vs tenant when using DB-per-tenant.

### 18.5 Mongoose-specific

- Global plugin applied in `tenancyjs-cli init` template.
- Compound indexes `{ tenantId: 1, ... }` code generation in init.
- Multi-tenant on embedded docs: document limitations.

### 18.6 Sequelize-specific

- `defaultScope` + `beforeValidate` hooks.
- Migrations per tenant DB for database-per-tenant strategy.

### 18.7 Knex / Lucid (Adonis)

- Knex: query builder wrapper or connection tagging.
- Lucid: `TenantScopedModel` base + `@beforeFind` hook; document schema codegen (`tenantId` in `database/schema`).

### 18.8 Drizzle

- Middleware/wrapper on `db.select/insert/update/delete` with tenant filter injection.
- Popular in Next.js stacks — P1 for marketing and adoption.

### 18.9 “Works with any ORM” extensibility

- Publish **Adapter RFC** and `create-adapter` CLI scaffold.
- Community adapters live in org `tenancyjs-community/*` or monorepo `packages/adapter-*` via PR.

---

## 19. Framework integration requirements

### 19.1 Matrix

| Framework | Integration package | Priority |
|-----------|---------------------|----------|
| **Next.js** (App Router) | `tenancyjs-integration-next` | P0 |
| **AdonisJS** v6/v7 | `tenancyjs-integration-adonis` | P0 |
| Express | `tenancyjs-integration-express` | P0 |
| Fastify | `tenancyjs-integration-fastify` | P1 |
| NestJS | `tenancyjs-integration-nest` | P1 |
| Hono | Community or P2 | P2 |
| Remix | P2 | P2 |

### 19.2 Common integration deliverables

- Middleware/factory with `onError` mapping.
- Request context bridge to ALS.
- Example app in `examples/`.
- Type exports for `TenantContext` augmentation (module augmentation where applicable).

---

## 20. Next.js-specific requirements

### 20.1 App Router

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-NX-01 | `middleware.ts` helper for subdomain/custom domain capture | P0 |
| FR-NX-02 | Route Handlers wrapper `withTenancy(handler)` | P0 |
| FR-NX-03 | Server Actions wrapper `withTenancyAction(action)` | P0 |
| FR-NX-04 | Document Edge vs Node runtime constraints | P0 |
| FR-NX-05 | RSC: tenant context passed via ALS in Node server components | P1 |
| FR-NX-06 | Example `examples/next-prisma` with row-level | P0 |
| FR-NX-07 | Example `examples/next-drizzle` | P1 |

### 20.2 Edge runtime limitations

- Edge cannot always reach central DB — patterns:
  - **Signed tenant JWT** minted by central auth route on Node.
  - **KV/Edge Config** mapping host → tenantId (sync from central).
- Document security implications and rotation.

### 20.3 Pages Router (legacy)

- `getServerSideProps` helper `withTenantGSSP` — P2 if demand.

### 20.4 Types

- Augment `NextRequest` with `tenant?: TenantRecord` in integration typings (optional).

---

## 21. AdonisJS-specific requirements

### 21.1 Alignment with Adonis patterns

Follow **BoringNode → `@adonisjs/queue`** pattern: framework-agnostic core, official-style community provider.

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-AD-01 | Adonis **provider** registering `TenancyManager` in container | P0 |
| FR-AD-02 | HTTP **middleware** (`initialize` / `end`) in server stack | P0 |
| FR-AD-03 | `config/tenancy.ts` stub via `tenancyjs-cli init --adonis` | P0 |
| FR-AD-04 | **Ace commands**: `tenancy:migrate`, `tenancy:list`, `tenancy:seed` | P1 |
| FR-AD-05 | **Lucid** row-level via Knex adapter + base model | P0 |
| FR-AD-06 | DB-per-tenant: bootstrapper switches Lucid default connection | P1 |
| FR-AD-07 | **Japa** plugin: `withTenant()` for functional tests | P0 |
| FR-AD-08 | Works with **Bouncer** policies scoped by tenant | P1 |
| FR-AD-09 | Document integration with `@adonisjs/auth`, session, inertia | P1 |
| FR-AD-10 | Example `examples/adonis-lucid` | P0 |

### 21.2 Adonis init template files

- `providers/tenancy_provider.ts`
- `start/kernel.ts` middleware registration snippet
- `config/tenancy.ts`
- `app/models/tenant.ts` (central)
- `app/models/tenant_domain.ts` (central)
- `app/models/mixins/tenant_scoped.ts` or base `TenantScopedModel`

### 21.3 Future Adonis ecosystem

- PR to [awesome-adonisjs](https://github.com/adonisjs-community/awesome-adonisjs) when v0.5 stable.
- Optional RFC to core team for listing on [adonisjs.com/packages](https://adonisjs.com/packages) (community).

---

## 22. CLI specification

### 22.1 Binary

- Command name: `tenancy`
- Entry: `tenancyjs-cli`
- Invocation: `npx tenancy <cmd>` or devDependency script.

### 22.2 Commands (full)

| Command | Description | Phase |
|---------|-------------|-------|
| `tenancyjs-cli init` | Interactive/detect stack, write config & stubs | P0 |
| `tenancyjs-cli init --yes` | Non-interactive with defaults | P1 |
| `tenancy doctor` | Validate config, adapters, DB connectivity | P1 |
| `tenancy list` | List tenants from central store | P0 |
| `tenancy make:tenant` | Create tenant record (dev) | P1 |
| `tenancy migrate` | Migrate tenant DB(s) | P1 |
| `tenancy migrate:rollback` | Rollback | P2 |
| `tenancy seed` | Seed tenant data | P1 |
| `tenancy run <file>` | Execute script in tenant context | P1 |
| `tenancy create-adapter` | Scaffold community ORM adapter | P2 |

### 22.3 `tenancyjs-cli init` flow (detailed)

1. Detect: `next.config.*`, `adonisrc.ts`, `nest-cli.json`, `express` in package.json.
2. Detect ORM: `@prisma/client`, `mongoose`, `sequelize`, `drizzle-orm`, `knex`, `typeorm`.
3. Prompt strategy (default `rowLevel`).
4. Prompt identification (default `subdomain` + `header`).
5. Write `tenancy.config.ts`.
6. Write framework middleware/provider stubs.
7. Write ORM registration file.
8. Write `.env.example` keys.
9. Print next steps (central migration, run example test).

### 22.4 CLI implementation stack

- **Commander** or **citty** for CLI parsing.
- **@clack/prompts** for UX.
- **cosmiconfig** optional for config discovery.
- TypeScript compiled to ESM; shebang `#!/usr/bin/env node`.

---

## 23. Configuration & environment

### 23.1 Environment variables (standard)

| Variable | Purpose |
|----------|---------|
| `TENANCY_STRATEGY` | Override strategy |
| `DATABASE_URL` | Central database |
| `TENANT_DATABASE_URL_TEMPLATE` | `{{tenantId}}` substitution |
| `TENANCY_STRICT` | `true`/`false` |
| `TENANCY_CACHE_TTL` | Resolver cache TTL |

### 23.2 Secrets

- Tenant DB credentials encrypted at rest (application responsibility; document libs: `@boringnode/encryption` pattern).

---

## 24. Central vs tenant application contexts

### 24.1 Central application routes

- Marketing site, tenant signup, billing webhooks (future), super-admin.
- Uses `runInCentralContext`; central models only.

### 24.2 Tenant application routes

- Product UI/API scoped to tenant.
- Automatic initialization via middleware.

### 24.3 Dual-route Next.js layout

- Route groups: `app/(central)/`, `app/(tenant)/` with shared `middleware.ts`.

### 24.4 Adonis

- Route groups or separate subdomains mapped in `routes.ts`; middleware on tenant groups.

---

## 25. Database & MongoDB requirements

### 25.1 SQL engines (via Prisma/Sequelize/Knex/Drizzle)

- PostgreSQL (priority), MySQL/MariaDB, SQLite (dev).

### 25.2 MongoDB (via Mongoose)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-M-01 | Row-level `tenantId` on collections | P0 |
| FR-M-02 | Index templates for `tenantId` | P0 |
| FR-M-03 | Database-per-tenant using `useDb()` or separate URI | P1 |
| FR-M-04 | Document transaction limitations | P1 |

### 25.3 Central store

- May be SQL even if tenants use Mongo (common); document **central SQL + tenant Mongo** setup.

### 25.4 Migrations

| Strategy | SQL | Mongo |
|----------|-----|-------|
| rowLevel | Central migration adds `tenantId` | Schema indexes via `migrate` scripts |
| databasePerTenant | Per-tenant migration loop | Per-tenant DB init scripts |

---

## 26. Background jobs & queues

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-Q-01 | Standard job envelope `{ tenantId, payload }` | P1 |
| FR-Q-02 | Helpers for BullMQ, BoringNode queue, Adonis queue | P1 |
| FR-Q-03 | Worker must call `runWithTenant` before handler | P0 |
| FR-Q-04 | Scheduled jobs: tenant context documented | P2 |

---

## 27. Caching, storage, and Redis

- Redis key prefix bootstrapper (P1).
- Integration with `ioredis` / `node-redis`.
- S3/R2 path prefix (P1) — align with Adonis Drive mental model in docs.

---

## 28. Security & compliance

| ID | Requirement | Priority |
|----|-------------|----------|
| SEC-01 | Strict mode prevents unscoped queries | P0 |
| SEC-02 | Integration tests for cross-tenant read/update/delete | P0 |
| SEC-03 | No silent fallback to “all tenants” | P0 |
| SEC-04 | Audit log hook interface (implementations optional) | P2 |
| SEC-05 | GDPR: tenant delete pipeline stub (`tenant.deleted`) | P2 |
| SEC-06 | Document threat model in docs/security.md | P1 |

---

## 29. Testing strategy

### 29.1 `tenancyjs-testing` API

```ts
await withTenant(tenantA, async () => {
  const rows = await prisma.post.findMany()
  expect(rows.every(r => r.tenantId === tenantA.id)).toBe(true)
})

await expectCrossTenantLeak(() => /* ... */).rejects.toThrow()
```

### 29.2 Test matrices

- Per adapter: row-level suite (shared).
- Per integration: Next middleware, Adonis HTTP client, Express supertest.
- CLI smoke tests in CI.

### 29.3 CI pipelines

- GitHub Actions: Node 20, 22 matrix.
- Services: Postgres, MySQL, MongoDB docker.
- Coverage threshold: core ≥ 90%, adapters ≥ 85%.

---

## 30. Documentation & developer experience

### 30.1 Docs site structure

1. Introduction & comparison to Tenancy for Laravel
2. Quickstart (CLI)
3. Concepts (strategies, central vs tenant, ALS)
4. Guides per framework (Next, Adonis, Express, Nest)
5. Guides per ORM
6. Security & threat model
7. Recipes (custom domain, JWT, Edge)
8. API reference (TypeDoc)
9. Contributing & Adapter RFC

### 30.2 README requirements (monorepo root)

- 30-second demo GIF
- Install + init commands
- Star badge CTA
- Compatibility table
- Link to security doc

### 30.3 Types documentation

- Export all public types from `tenancyjs-core/types`.
- `defineConfig` provides IntelliSense for config file.
- Framework packages export augmentation instructions.

---

## 31. Release, versioning, and governance

| Item | Policy |
|------|--------|
| License | MIT |
| CoC | Contributor Covenant |
| Security | SECURITY.md + responsible disclosure |
| RFCs | Required for breaking core API |
| Releases | Changesets; changelog in repo |
| Trademark | “TenancyJS” — document fair use |

### 31.1 Optional monetization (outside core PRD)

- Paid **starter kits** (separate repos) — does not affect core MIT promise.
- Consulting/audits — personal/company service, not product coupling.

---

## 32. Phased delivery roadmap

### Phase 0 — Foundation (Weeks 1–3)

- [ ] Monorepo scaffold (pnpm, turbo, changesets)
- [ ] `tenancyjs-core` ALS + TenancyManager + events
- [ ] `tenancyjs-identifiers` subdomain + header
- [ ] `tenancyjs-testing` withTenant helpers
- [ ] Strict mode + leak test utilities
- [ ] Docs: concepts + threat model draft

**Exit:** Unit tests green; no framework yet.

### Phase 1 — First shippable vertical (Weeks 4–7)

- [ ] `tenancyjs-adapter-prisma` row-level
- [ ] `tenancyjs-integration-express`
- [ ] `tenancyjs-cli` — `init`, `list`
- [ ] `examples/express-prisma`
- [ ] README launch quality

**Exit:** E2E proves tenant isolation; public v0.1.0 tag.

### Phase 2 — Mongo + SQL ORM breadth (Weeks 8–11)

- [ ] `tenancyjs-adapter-mongoose`
- [ ] `tenancyjs-adapter-sequelize`
- [ ] CLI templates for both
- [ ] `examples/express-mongoose`

**Exit:** v0.2.0 — “Prisma + Mongoose + Sequelize”.

### Phase 3 — Next.js (Weeks 12–15)

- [ ] `tenancyjs-integration-next` middleware + handlers + actions
- [ ] Edge vs Node documentation
- [ ] `examples/next-prisma`
- [ ] `tenancyjs-adapter-drizzle` (P1)

**Exit:** v0.3.0 — Next.js called out on README.

### Phase 4 — AdonisJS (Weeks 16–19)

- [ ] `tenancyjs-adapter-knex` + Lucid scoped model
- [ ] `tenancyjs-integration-adonis` provider + middleware
- [ ] Ace commands
- [ ] Japa plugin
- [ ] `examples/adonis-lucid`

**Exit:** v0.4.0 — Adonis listed as first-class.

### Phase 5 — Database-per-tenant (Weeks 20–26)

- [ ] `tenancyjs-bootstrappers-database` provisioning
- [ ] CLI `migrate` / `seed` loops
- [ ] Event pipeline `tenant.created`
- [ ] Nest + Fastify integrations

**Exit:** v0.5.0 — parity with key stancl multi-DB features.

### Phase 6 — v1.0 hardening

- [ ] Schema-per-tenant Postgres
- [ ] Cache/storage bootstrappers
- [ ] Impersonation + resource sync (if validated)
- [ ] TypeORM adapter
- [ ] Performance benchmarks published

**Exit:** v1.0.0 — stable API semver commitment.

---

## 33. Risks & mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Scope explosion (all ORMs day one) | Burnout, low quality | Tiered adapters; RFC for new ORMs |
| Next.js Edge constraints | Confusion, bugs | Explicit Edge recipes; JWT bridge |
| Prisma extension API changes | Maintenance | Pin peer ranges; CI against multiple versions |
| Low Adonis adoption | Fewer stars from that niche | Next.js + Prisma primary marketing |
| Security incident in adapter | Reputation damage | Strict mode + mandatory leak tests |
| Star chasing over stability | Broken releases | Phase gates; doctor command; RFC |
| Fragmented repos | Split stars | Monorepo policy in CONTRIBUTING |

---

## 34. Open questions & decisions log

| # | Question | Decision | Date |
|---|----------|----------|------|
| D1 | Default strategy for `init`? | **rowLevel** | 2026-06-29 |
| D2 | Default identification? | **subdomain + header** | 2026-06-29 |
| D3 | Monorepo vs multi-repo? | **Monorepo** | 2026-06-29 |
| D4 | License? | **MIT** | 2026-06-29 |
| D5 | Org name `tenancyjs`? | TBD — register GitHub/npm org early | — |
| D6 | Edge tenant resolution pattern? | TBD — prototype in Phase 3 | — |
| D7 | Central DB always SQL? | Recommend SQL; allow Mongo central with docs | — |

---

## 35. Appendices

### Appendix A — Feature parity checklist (stancl/tenancy)

| stancl feature | TenancyJS phase |
|----------------|-----------------|
| Automatic bootstrapping | P0–P1 |
| Manual mode | P1 |
| Domain identification | P0 |
| Subdomain identification | P0 |
| Path identification | P1 |
| Request data identification | P2 |
| CLI identification | P1 |
| Multi-database tenancy | P1 |
| Single-database tenancy | P0 |
| PostgreSQL schema mode | P2 |
| Tenant migrations | P1 |
| Tenant migrate:fresh | P2 |
| Tenant seed | P1 |
| Redis/cache separation | P1 |
| Filesystem separation | P1 |
| Queue context | P1 |
| Resource syncing | P2 |
| User impersonation | P2 |
| Cached tenant lookup | P1 |
| Nova integration | N/A (OSS admin out of scope) |
| SaaS boilerplate | Separate optional repo |

### Appendix B — ORM → Node framework affinity

| ORM | Common frameworks |
|-----|-------------------|
| Prisma | Next.js, Nest, Express |
| Drizzle | Next.js, Astro |
| Mongoose | Express, Nest |
| Sequelize | Express, legacy Nest |
| Knex/Lucid | AdonisJS |
| TypeORM | Nest |

### Appendix C — Example `tenancyjs-cli init` output files

```text
tenancy.config.ts
tenancy.events.ts
lib/tenancy/register-adapters.ts
middleware/tenancy.middleware.ts   # framework-specific path
.env.example                       # appended keys
tests/tenancy/isolation.test.ts    # optional --with-tests
```

### Appendix D — Glossary

| Term | Definition |
|------|------------|
| **Central context** | Application mode without tenant scoping (landlord). |
| **Tenant context** | Scoped mode after `initialize()`. |
| **Bootstrapper** | Plugin that applies/removes tenant-specific runtime changes. |
| **Resolver** | Finds tenant from HTTP/job metadata. |
| **Strict mode** | Throws when tenant context missing for scoped operations. |
| **Row-level** | Shared DB tables with `tenantId` discriminator. |

### Appendix E — References

- [Tenancy for Laravel](https://tenancyforlaravel.com/)
- [stancl/tenancy GitHub](https://github.com/archtechx/tenancy)
- [Tenancy Laravel SaaS boilerplate (paid reference)](https://tenancyforlaravel.com/saas-boilerplate)
- [AdonisJS documentation](https://docs.adonisjs.com/)
- [BoringNode ecosystem](https://github.com/boringnode)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [Node.js AsyncLocalStorage](https://nodejs.org/api/async_context.html)

---

## Document approval

| Role | Name | Status |
|------|------|--------|
| Product owner | TBD | Draft |
| Tech lead | TBD | Draft |
| Security review | TBD | Pending Phase 1 |

---

*End of BRD/PRD v1.0.0*