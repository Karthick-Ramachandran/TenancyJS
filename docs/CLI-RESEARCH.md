# TenancyJS CLI — Research & Command Specification

Research date: 2026-06-29  
Purpose: Define a **complete, worthwhile** CLI for multi-tenancy on Node.js — informed by [Tenancy for Laravel](https://tenancyforlaravel.com/docs/v3/console-commands), [stancl/tenancy commands](https://github.com/archtechx/tenancy/tree/master/src/Commands), and native tooling for **Next.js**, **AdonisJS**, **NestJS**, **Express**, **Prisma**, **Sequelize**, and **Mongoose**.

---

## 1. CLI design principle (avoid half-hearted)

### 1.1 Orchestrate, do not reimplement ORMs

| Layer | Who owns it | Tenancy CLI role |
|-------|-------------|------------------|
| Schema migrations | Prisma / Sequelize CLI / Lucid Ace / Drizzle Kit / migrate-mongo | **Delegate** with per-tenant connection URL or `--connection` |
| Tenant registry | TenancyJS central DB | **Own** (CRUD, domains, status) |
| Request context | Framework middleware | **Scaffold** via `init` |
| Isolation | `tenancyjs-adapter-*` | **Wire** via `init` + `doctor` |

Users should run **one mental model**:

```bash
npx tenancy <tenant-operation>
```

…while the CLI internally runs `prisma migrate deploy`, `node ace migration:run`, or `sequelize db:migrate` when appropriate.

### 1.2 Two entry points (same engine)

| Entry | When |
|-------|------|
| `npx tenancy …` | Express, Next.js, Nest, CI, Docker |
| `node ace tenancy:…` | AdonisJS (thin Ace wrapper → same `TenancyCommandRunner`) |

### 1.3 Global flags (all tenant-aware commands)

| Flag | Description |
|------|-------------|
| `--tenants=<id>` | Repeatable; default = all active tenants |
| `--skip-tenants=<id>` | Exclude tenants |
| `--parallel=<n>` | Parallel tenant execution (DB-per-tenant) |
| `--skip-failing` | Continue loop if one tenant fails |
| `--dry-run` | Print actions without executing |
| `--json` | Machine-readable output (CI) |
| `--config=<path>` | Default `tenancy.config.ts` |

---

## 2. Reference: stancl/tenancy Artisan commands (inspiration)

| Laravel command | Purpose |
|-----------------|---------|
| `tenancy:install` | Publish config, routes, provider, migrations |
| `tenants:list` | List tenants + domains |
| `tenants:migrate` | Migrate tenant DB(s); `--skip-failing`, parallel |
| `tenants:rollback` | Roll back tenant migrations |
| `tenants:seed` | Seed tenant DB(s) |
| `tenants:migrate-fresh` | Wipe + migrate tenant DB |
| `tenants:run` | Run any Artisan command per tenant |
| `tenants:dump` | Schema dump for tenant DB |
| `tenants:link` | Storage symlinks per tenant |
| `tenants:up` / `tenants:down` | Per-tenant maintenance mode |
| `tenants:pending-create` | Pre-provision empty tenants (fast signup pool) |
| `tenants:tinker` | REPL in tenant context |
| (+) `CreateUserWithRLSPolicies` | Postgres RLS — Node equivalent optional |

**TenancyJS should reach parity on the bold rows** for database-per-tenant; row-level strategy uses a subset.

---

## 3. Reference: framework-native CLIs (what users already know)

### 3.1 AdonisJS (Ace)

| Command | Relevance to tenancy |
|---------|----------------------|
| `node ace make:migration` | Central + tenant migration files |
| `node ace migration:run` | Per-connection run (`--connection=tenant_x`) |
| `node ace migration:rollback` | Per-tenant rollback |
| `node ace migration:status` | Per-tenant status |
| `node ace migration:fresh` / `refresh` | Dev only; tenant loops |
| `node ace db:seed` | Tenant seeders |
| `node ace add <package>` | Install `tenancyjs-integration-adonis` |
| `MigrationRunner` (programmatic) | Provision UI / `tenancy provision` |

Lucid docs explicitly describe **shared migrations + `--connection`** for multi-tenant DBs — this is the Adonis-native primitive TenancyJS must wrap.

### 3.2 Next.js

Next.js has **no** tenancy CLI. Relevant toolchain:

| Tool | Role |
|------|------|
| `next dev` / `build` | App |
| `prisma migrate dev/deploy` | SQL migrations (most common) |
| `drizzle-kit migrate` / `push` | SQL migrations (growing share) |
| `middleware.ts` | Subdomain / host identification |

Tenancy CLI must **`init` scaffold**: `middleware.ts`, `tenancy.config.ts`, route groups `(central)` / `(tenant)`, env template, optional `instrumentation.ts` hook.

### 3.3 NestJS

| Tool | Role |
|------|------|
| `nest generate module/service` | App structure |
| `nest build` | Deploy |
| Often **Prisma/TypeORM** migrations via npm scripts | Tenancy delegates |

Optional: `nest-commander` subcommands mirroring `tenancy` — P2; standalone `npx tenancy` is enough for v1.

### 3.4 Express

No framework CLI. **100% `npx tenancyjs-cli init`** + npm scripts.

---

## 4. Reference: ORM CLIs (delegation targets)

### 4.1 Prisma (Next, Nest, Express)

| Prisma command | Tenancy wrapper use |
|----------------|---------------------|
| `migrate deploy` | **Production** per-tenant URL |
| `migrate dev` | Dev central only; tenant sandbox via `tenancy migrate --tenant` |
| `migrate status` | `tenancy migrate:status` |
| `db push` | Dev shortcut (document risks) |
| `db seed` | `tenancy seed` delegate |
| `generate` | After central schema change |

Implementation: set `DATABASE_URL` per tenant in subprocess env.

### 4.2 Sequelize

| sequelize-cli command | Tenancy wrapper use |
|-----------------------|---------------------|
| `db:migrate` | `--url` per tenant |
| `db:migrate:undo` / `undo:all` | `tenancy migrate:rollback` |
| `db:migrate:status` | Status in loop |
| `db:seed:all` | `tenancy seed` |
| `db:create` / `db:drop` | `tenancy provision` / `deprovision` |
| `migration:generate` | `tenancy make:migration` (tenant path) |

### 4.3 Mongoose / MongoDB

Mongoose has **no official migration CLI**. Ecosystem:

| Tool | Tenancy wrapper use |
|------|---------------------|
| **migrate-mongo** | `migrate up` per tenant DB |
| Custom JS migration files | Tenancy `migrations/tenant/` runner |
| `mongosh` | `tenancy shell` optional |

Row-level Mongo: central migration adds indexes on `tenantId`; `tenancy sync:indexes`.

### 4.4 Drizzle (Next.js)

| drizzle-kit | Tenancy wrapper |
|-------------|-----------------|
| `migrate` | Per-tenant DB URL |
| `generate` | `tenancy make:migration` |
| `push` | Dev only |

### 4.5 Knex / Lucid (Adonis)

Delegate to **`node ace migration:* --connection=<tenant>`** or `MigrationRunner` with dynamic connection name.

---

## 5. Full TenancyJS command catalog

Legend: **P0** = v0.1–0.3 MVP · **P1** = v0.4–0.5 · **P2** = v1+ · **P3** = optional

### 5.1 Bootstrap & diagnostics

| Command | Description | Phase |
|---------|-------------|-------|
| `tenancyjs-cli init` | Detect stack; write config, middleware, adapter registration, env, optional test | **P0** |
| `tenancyjs-cli init --framework=next\|adonis\|express\|nest` | Force framework template | **P0** |
| `tenancyjs-cli init --orm=prisma\|sequelize\|mongoose\|drizzle\|lucid` | Force ORM template | **P0** |
| `tenancyjs-cli init --strategy=rowLevel\|databasePerTenant\|schemaPerTenant` | Set isolation strategy | **P0** |
| `tenancy install` | Alias of `init` (Laravel familiarity) | **P0** |
| `tenancy doctor` | Validate config, DB, adapters, leak-test config, framework files | **P0** |
| `tenancy detect` | Print detected framework/ORM/versions (debug) | **P1** |
| `tenancy print-config` | Resolved config (secrets redacted) | **P1** |
| `tenancy upgrade` | Migrate `tenancy.config` schema between major versions | **P2** |

**`init` must scaffold (by stack):**

| Stack | Files |
|-------|--------|
| **Express** | `tenancy.config.ts`, `src/tenancy/register.ts`, `src/middleware/tenancy.ts`, central migration stub |
| **Next.js** | above + `middleware.ts` patch, `lib/tenancy/server.ts`, `app/(central)`, `app/(tenant)` docs |
| **NestJS** | `TenancyModule`, guard/middleware, `main.ts` note |
| **Adonis** | provider, `config/tenancy.ts`, kernel middleware, `commands/tenancy/*` stubs, `start/tenancy.ts` |
| **Prisma** | `prisma/schema central models`, snippet for `tenantId` on models, extension register |
| **Sequelize** | `.sequelizerc` paths `migrations/central`, `migrations/tenant` |
| **Mongoose** | plugin register file, `tenantId` index script |

---

### 5.2 Central database (landlord)

| Command | Description | Phase |
|---------|-------------|-------|
| `tenancy migrate:central` | Run central migrations only | **P0** |
| `tenancy migrate:central:status` | Central migration status | **P1** |
| `tenancy make:central-migration` | New central migration (ORM-specific generator) | **P1** |

Central tables: `tenants`, `tenant_domains`, optional `tenant_users`, `pending_tenants`.

---

### 5.3 Tenant registry (CRUD)

| Command | Description | Phase |
|---------|-------------|-------|
| `tenancy list` | List tenants (id, slug, status, domains) — `tenants:list` | **P0** |
| `tenancy show <tenant>` | JSON/human details + DB info | **P1** |
| `tenancy create` | Interactive create tenant + optional domain | **P0** |
| `tenancy create --slug=acme --domain=acme.app.com` | Non-interactive | **P1** |
| `tenancy update <tenant>` | Status, metadata | **P1** |
| `tenancy suspend <tenant>` | Set suspended | **P1** |
| `tenancy activate <tenant>` | Set active | **P1** |
| `tenancy delete <tenant>` | Soft/hard delete + optional deprovision | **P1** |
| `tenancy domain:add <tenant> <domain>` | Attach domain | **P1** |
| `tenancy domain:remove <tenant> <domain>` | Detach domain | **P1** |
| `tenancy domain:list` | All domains | **P2** |

---

### 5.4 Provisioning (database-per-tenant / schema-per-tenant)

| Command | Description | Phase |
|---------|-------------|-------|
| `tenancy provision <tenant>` | Create DB/schema, run migrations, seed optional | **P1** |
| `tenancy deprovision <tenant>` | Drop DB/schema (with `--force`) | **P1** |
| `tenancy pending:create [--count=5]` | Pool of unassigned tenants (stancl) | **P2** |
| `tenancy pending:list` | Show pending pool | **P2** |
| `tenancy assign <pendingId> --slug=acme` | Assign pending tenant to customer signup | **P2** |

---

### 5.5 Tenant migrations & seeds (ORM-delegated)

| Command | Description | Phase |
|---------|-------------|-------|
| `tenancy migrate` | Migrate **all** tenants (or central only if row-level) | **P0** |
| `tenancy migrate --tenant=<id>` | Single tenant | **P0** |
| `tenancy migrate:status` | Per-tenant status table | **P1** |
| `tenancy migrate:rollback` | Rollback last batch per tenant | **P1** |
| `tenancy migrate:fresh` | Wipe + migrate (dev; `--force`) | **P1** |
| `tenancy seed` | Run tenant seeders all/selected | **P1** |
| `tenancy seed --class=...` | Sequelize/Adonis-style seeder name | **P2** |
| `tenancy dump [--tenant=]` | Schema dump (SQL); stancl `tenants:dump` | **P2** |

**Row-level strategy:** `tenancy migrate` = single central DB migration (adds `tenantId`, indexes); message explains no loop.

**ORM delegation matrix:**

| ORM | `tenancy migrate` subprocess |
|-----|------------------------------|
| Prisma | `prisma migrate deploy` |
| Sequelize | `sequelize db:migrate --url` |
| Mongoose | `migrate-mongo up` or custom runner |
| Drizzle | `drizzle-kit migrate` |
| Lucid | `ace migration:run --connection` or `MigrationRunner` |

---

### 5.6 Row-level adoption (existing apps)

| Command | Description | Phase |
|---------|-------------|-------|
| `tenancy sync:tenant-column` | Generate migration to add `tenantId` + indexes to listed models | **P1** |
| `tenancy sync:indexes` | Mongo: ensure `tenantId` indexes | **P1** |
| `tenancy backfill:tenant <tenant> --table=posts` | Assign default tenant to orphan rows (dangerous; dry-run) | **P2** |

---

### 5.7 Run arbitrary code in tenant context

| Command | Description | Phase |
|---------|-------------|-------|
| `tenancy run <script.ts>` | Execute file inside `runWithTenant` | **P0** |
| `tenancy run --tenant=x -- npm run custom` | Subprocess with env + ALS bootstrap | **P1** |
| `tenancy exec <tenant> '<js expression>'` | One-liner (like `node -e`) | **P2** |
| `tenancy shell [tenant]` | REPL / `tenancy:tinker` | **P2** |

---

### 5.8 Maintenance & operations

| Command | Description | Phase |
|---------|-------------|-------|
| `tenancy down [tenants…]` | Maintenance flag (middleware returns 503) | **P2** |
| `tenancy up [tenants…]` | Clear maintenance | **P2** |
| `tenancy cache:clear [--tenant=]` | Tenant-prefixed cache purge | **P2** |
| `tenancy storage:link [tenants…]` | Create storage path prefixes / symlinks | **P2** |
| `tenancy storage:link --remove` | Reverse | **P2** |

---

### 5.9 Security & quality

| Command | Description | Phase |
|---------|-------------|-------|
| `tenancy test:leak` | Run isolation test suite against configured ORM | **P0** |
| `tenancy test:leak --tenant-a --tenant-b` | Custom pair | **P1** |
| `tenancy audit` | Static checks: raw queries, missing middleware, models without scope | **P2** |
| `tenancy impersonate <tenant> <userId>` | Generate short-lived impersonation token (post-v1 feature) | **P3** |

---

### 5.10 Code generation

| Command | Description | Phase |
|---------|-------------|-------|
| `tenancy make:migration <name>` | Central or `--tenant` path; ORM-specific stub | **P1** |
| `tenancy make:seeder <name>` | Tenant seeder stub | **P2** |
| `tenancy make:adapter <name>` | Community ORM adapter scaffold | **P2** |
| `tenancy make:integration <framework>` | Advanced users | **P3** |

---

### 5.11 Adonis Ace aliases (same runner)

| Ace command | Maps to |
|-------------|---------|
| `node ace tenancy:install` | `tenancyjs-cli init --framework=adonis` |
| `node ace tenancy:list` | `tenancy list` |
| `node ace tenancy:migrate` | `tenancy migrate` |
| `node ace tenancy:seed` | `tenancy seed` |
| `node ace tenancy:provision` | `tenancy provision` |
| `node ace tenancy:doctor` | `tenancy doctor` |

Register via Adonis provider; implementation calls shared `tenancyjs-cli-core` library (no duplicate logic).

---

## 6. `tenancyjs-cli init` interactive flow (detailed)

```
1. Scan package.json + lockfile
2. Framework: next | adonis | nest | express | unknown
3. ORM: prisma | sequelize | mongoose | drizzle | lucid | none
4. Strategy: rowLevel (recommended) | databasePerTenant | schemaPerTenant
5. Identification: subdomain | header | jwt | path (multi-select)
6. Central DB URL present? → test connection
7. Write files + patch (idempotent)
8. Run tenancy migrate:central (optional)
9. Print: doctor, test:leak, list, create
```

**Next.js branch extras:**

- Warn if `middleware` runs on Edge only → recommend JWT/header resolution pattern.
- Add npm scripts:

```json
{
  "scripts": {
    "tenancy:migrate": "tenancy migrate",
    "tenancy:seed": "tenancy seed",
    "tenancy:doctor": "tenancy doctor"
  }
}
```

**Adonis branch extras:**

- `node ace configure tenancyjs-integration-adonis` style configure.ts if package supports it.
- Document `migration:run --connection=tenant_*` for manual debugging.

---

## 7. What makes the CLI “worthwhile” (not half-hearted)

| Capability | Why it matters |
|------------|----------------|
| **`doctor` + `test:leak`** | Trust — proves isolation; shareable in CI |
| **Tenant loop with `--parallel`** | Production ops at scale |
| **`provision` / `deprovision`** | Database-per-tenant without custom scripts |
| **`run` / Ace parity** | One-off fixes, emails, reindex per tenant |
| **ORM delegation** | Respects Prisma/Sequelize/Lucid workflows users already have |
| **`init` that detects real projects** | First 15 minutes success metric |
| **`pending:create` pool** | SaaS signup speed (stancl advanced) |
| **JSON output** | Platform teams automate provisioning |

---

## 8. Phase delivery (CLI only)

| Release | Commands |
|---------|----------|
| **v0.1** | `init`, `install`, `doctor`, `list`, `create`, `migrate`, `migrate:central`, `run`, `test:leak` |
| **v0.3** | + Next `init` template, Prisma + Sequelize + Mongoose delegation |
| **v0.4** | + Adonis Ace wrappers, Lucid `MigrationRunner` integration |
| **v0.5** | + `provision`, `deprovision`, `migrate:rollback`, `migrate:fresh`, `seed`, `migrate:status` |
| **v1.0** | + `domain:*`, `sync:tenant-column`, `pending:*`, `down`/`up`, `dump` |

---

## 9. Implementation note: shared `tenancyjs-cli-core`

```
tenancyjs-cli-core     # TenancyCommandRunner, tenant iteration, ORM delegates
tenancyjs-cli          # bin `tenancy` → commander/citty
tenancyjs-integration-adonis/commands  # Ace re-exports
```

All framework-specific code lives in **init templates**, not in command logic.

---

## 10. References

- [Tenancy for Laravel — Console commands](https://tenancyforlaravel.com/docs/v3/console-commands)
- [archtechx/tenancy Commands](https://github.com/archtechx/tenancy/tree/master/src/Commands)
- [Lucid — Migrations & multiple connections](https://lucid.adonisjs.com/docs/migrations/introduction)
- [Sequelize CLI](https://sequelize.org/docs/v6/other-topics/migrations/)
- [Prisma CLI reference](https://www.prisma.io/docs/orm/reference/prisma-cli-reference)

---

*End of CLI research spec*