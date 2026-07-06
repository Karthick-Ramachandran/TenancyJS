# `tenancyjs-core`

The foundation of **TenancyJS** — a fail-closed, TypeScript-first multi-tenancy toolkit for Node.js.
Tenant identity follows your async scope, and any tenant-aware access without a valid context **throws**
instead of returning another tenant's data.

> **📚 Full documentation: [tenancyjs.pages.dev](https://tenancyjs.pages.dev)** — start here.

`tenancyjs-core` gives you the framework-neutral tenant context, lifecycle, and adapter contract. You
compose it with **an adapter** (your ORM) and **an integration** (your framework):

```
tenancyjs-core  ×  an adapter (Prisma/Knex/Lucid/TypeORM/Sequelize/Drizzle/Mongoose)  ×  an integration (Express/Next.js/NestJS/AdonisJS)
```

## Install

```bash
npm install tenancyjs-core
# …then add the adapter for your ORM and the integration for your framework, e.g.:
npm install tenancyjs-adapter-prisma tenancyjs-integration-express
```

During the beta the packages are on the `beta` dist-tag: `npm install tenancyjs-core@beta`.

## The CLI — `tenancyjs-cli`

One operational CLI for your whole tenant lifecycle. Run any command with `npx tenancy …` (no install),
or `npm install -g tenancyjs-cli` for a global `tenancy`. Every command takes `--json` for
machine-readable, secret-redacted output.

**Scaffold & inspect**

```bash
npx tenancy init            # detect your framework + ORM and scaffold the wiring
npx tenancy doctor          # inspect a project's static setup + migration effort
npx tenancy tenant check    # health-probe the runtime and warn on untested combinations
npx tenancy test:leak --test-file ./leak.mjs   # run a cross-tenant isolation leak test
```

**Manage tenants** (backed by your own store — see [Configuration](https://tenancyjs.pages.dev/docs/getting-started/configuration))

```bash
npx tenancy tenant list                 # list tenants from your store
npx tenancy tenant show acme            # show one tenant
npx tenancy tenant create acme --set plan=pro --set region=eu
npx tenancy tenant suspend acme         # / tenant activate acme
```

**Provision, migrate & run** (per-tenant placement + scripts)

```bash
npx tenancy tenant provision acme       # create the tenant's schema/database (your hook)
npx tenancy tenant migrate --all        # migrate every tenant, reporting each outcome
npx tenancy tenant deprovision acme     # drop it (explicit id only — never --all)
npx tenancy run ./backfill.ts --tenant acme     # run a script inside a tenant scope
npx tenancy run ./rollup.ts --central           # …or in the central (cross-tenant) scope
```

Full reference: **[CLI docs →](https://tenancyjs.pages.dev/docs/cli)**.

**Or let an AI do it:** copy a prompt from
[Build with AI](https://tenancyjs.pages.dev/docs/build-with-ai) and paste it into your assistant.

## How it works (30 seconds)

1. An **integration** resolves the tenant per request and opens a scope.
2. Your code queries through the **adapter**'s scoped client — no manual `WHERE tenant_id`.
3. Outside a valid scope, tenant-aware access **throws** instead of leaking.

```ts
import { TenancyManager, type TenantRecord } from "tenancyjs-core";

interface Tenant extends TenantRecord {
  readonly id: string;
}

const manager = new TenancyManager<Tenant>();

await manager.runWithTenant({ id: "acme" }, async () => {
  // Every tenant query inside here is scoped to "acme".
  const tenant = manager.getTenantOrFail();
});

// Outside a scope? It fails closed.
manager.getTenantOrFail(); // ✗ throws TenantContextError — never an unscoped read
```

Full end-to-end wiring is in the [Quickstart](https://tenancyjs.pages.dev/docs/getting-started/quickstart).

## Where to next

| Guide                                                                            |                                                                  |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [Getting started](https://tenancyjs.pages.dev/docs/getting-started/installation) | Install + scaffold for your stack                                |
| [Adapters](https://tenancyjs.pages.dev/docs/adapters)                            | Prisma · Knex · Lucid · TypeORM · Sequelize · Drizzle · Mongoose |
| [Integrations](https://tenancyjs.pages.dev/docs/integrations)                    | Express · Next.js · NestJS · AdonisJS                            |
| [Strategies](https://tenancyjs.pages.dev/docs/strategies/row-level)              | row-level · schema-per-tenant · database-per-tenant              |
| [The rules & limitations](https://tenancyjs.pages.dev/docs/concepts/limitations) | What's rejected, and why — read before you build                 |

---

## Core API reference

The primitives this package provides directly.

### Guarantees

- Tenant identity is scoped with Node.js `AsyncLocalStorage`, never process-global mutable state.
- Missing tenant context fails with a typed `TenantContextError`.
- Central execution is explicit and lexical.
- Nested and concurrent scopes restore their parent automatically.
- Bootstrappers set up in registration order and revert in reverse order.
- Cleanup continues after failures and reports every cleanup error.

### Explicit central context

```ts
await manager.runInCentralContext(async () => {
  // Central (cross-tenant) work is explicit. getTenantOrFail() throws with reason "central" here.
});
```

Resolver failure never enters central mode — framework integrations decide whether a route is central
before calling this API.

### Bootstrappers and lifecycle events

Bootstrappers are fixed when the manager is created; each is `{ id, bootstrap, revert }`:

```ts
const manager = new TenancyManager({
  bootstrappers: [
    {
      id: "database",
      async bootstrap(context) {
        /* prime context-local resources for context.tenant */
      },
      async revert(context) {
        /* release only resources owned by this scope — always runs on teardown */
      },
    },
  ],
});
```

Lifecycle order: `tenancy.initializing` → bootstrap (registration order) → `tenancy.initialized` →
callback → `tenancy.ending` → revert (reverse order) → `tenancy.ended`. Subscribe with
`manager.on(event, listener)`; the returned function unsubscribes idempotently.

### Isolation strategy intent

```ts
import { defineConfig } from "tenancyjs-core";

export default defineConfig({ strategy: "rowLevel" });
```

Core carries strategy intent; adapters implement the actual database isolation.

### Errors

- `TenantContextError` — tenant access with no scope, or in central mode.
- `InvalidTenantError` — a tenant lacks a non-empty string `id`.
- `InvalidBootstrapperError` / `DuplicateBootstrapperError` — invalid manager configuration.
- `TenancyLifecycleError` — cleanup failed; inspect `primaryError`, `hasPrimaryError`, `cleanupErrors`.

## License

MIT
