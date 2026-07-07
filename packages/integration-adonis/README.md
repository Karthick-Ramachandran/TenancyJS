# tenancyjs-integration-adonis

Fail-closed AdonisJS 7 request lifecycle integration for TenancyJS Lucid tenancy.

> **New to TenancyJS? [Start with the docs →](https://tenancyjs.pages.dev/docs/getting-started/installation)** — install, the `tenancyjs-cli` CLI, and how this package fits with an adapter + integration.

The application owns the `TenancyManager`, tenant resolver, and Lucid tenancy service
(`tenancyjs-adapter-lucid`). This package wires them into AdonisJS through a service provider
and a tenant-route middleware. It creates no hidden tenant state, database client, or central-mode
path, and it never authenticates users.

- Targets AdonisJS `>=7.3.0 <8`, Lucid `>=22.4.0 <23`, PostgreSQL 17, and Node 24.
- Governed by ADR-0014 (provider/middleware/testing contract) on the ADR-0013 Node 24 baseline.

## Usage

Define one application-owned config (`config/tenancy.ts`):

```ts
import { defineAdonisTenancyConfig } from "tenancyjs-integration-adonis";

export default defineAdonisTenancyConfig({
  manager, // application-owned TenancyManager
  resolver, // application-owned tenant resolver
  tenancy, // createLucidTenancy(...) service
});
```

Register the provider in `adonisrc.ts`:

```ts
providers: [() => import("tenancyjs-integration-adonis/provider")];
```

Apply the middleware to tenant route groups only. Central routes omit it and enter explicit core
central scope through application-owned code.

- Missing/invalid identity → sanitized 400; unknown/suspended → sanitized 404; ambiguous registry
  state → sanitized 500. Resolver failure never becomes central context.
- The tenant database scope ends when the handler settles. Work streamed or spawned after middleware
  settlement is outside the supported database lifetime.
