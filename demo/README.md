# TenancyJS demo - Express + Sequelize, database-per-tenant

A small, runnable app that proves tenant isolation for real. Each tenant gets its
own PostgreSQL database, so isolation is by construction.

> The root README's hero GIF (`demo.gif`) is the `tenancyjs-cli init` wizard,
> rendered from [`init.tape`](./init.tape). This folder is the deeper story you
> run yourself.

## What it shows

- **`demo.mjs`** - two tenants write a row with the same primary key into their
  own databases; each reads back only its own row; forgetting the tenant scope
  throws `TenantContextError` (fail-closed); and `unrestricted()` raw SQL stays
  inside the tenant's own database.
- **`membership.mjs` / `server.mjs`** - resolution is not authorization. The
  tenant comes from a spoofable `x-tenant-id` header, but a request only enters a
  tenant scope if the authenticated user is a member of that tenant (ADR-0035). A
  spoofed header gets a sanitized `404` - identical to an unknown tenant, so
  nothing leaks.
- **`tenancy.leak.test.mjs`** - the same isolation assertions as a CI leak test,
  runnable with `tenancy test:leak`.

## Prerequisites

- Node.js 24+
- A reachable PostgreSQL. Set `DATABASE_URL` (defaults to
  `postgres://postgres:postgres@localhost:5432/postgres`). The role needs
  `CREATE DATABASE` because the demo provisions a database per tenant.

## Run it

```bash
npm install
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres

node provision.mjs     # create the two tenant databases + posts table
node demo.mjs          # the isolation story
node membership.mjs    # the spoofed-header-is-refused story
```

Prefer a real server to curl?

```bash
node server.mjs
curl -H 'x-tenant-id: acme'   localhost:3000/posts   # 200, acme's posts
curl -H 'x-tenant-id: globex' localhost:3000/posts   # 404, the demo user is not a member
```

Prove it in CI:

```bash
npx tenancyjs-cli test:leak --test-file tenancy.leak.test.mjs
```

## Re-render the GIFs

[VHS](https://github.com/charmbracelet/vhs) drives the recordings:

```bash
vhs init.tape          # writes demo.gif — the init wizard (root README hero)
vhs demo.tape          # writes isolation.gif — this database-per-tenant demo
```
