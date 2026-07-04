# `@tenancyjs/integration-express`

Fail-closed Express 5 request lifecycle integration for TenancyJS.

The middleware resolves tenant identity from the request, enters the application-owned
`TenancyManager`, and keeps that lexical scope active until the response finishes, closes, or the
request aborts. It does not authenticate users, authorize membership, scope ORM queries, or expose a
request-controlled central mode.

## Install

```bash
pnpm add @tenancyjs/core @tenancyjs/identifiers @tenancyjs/integration-express express
```

The supported target is Express 5.2.x on the repository's Node 24 baseline.

## Usage

```ts
import { TenancyManager } from "@tenancyjs/core";
import {
  HeaderTenantResolver,
  TenantResolutionChain,
} from "@tenancyjs/identifiers";
import { createExpressTenancyMiddleware } from "@tenancyjs/integration-express";
import express from "express";

const manager = new TenancyManager();
const resolver = new TenantResolutionChain({
  resolvers: [new HeaderTenantResolver()],
  store: {
    async find(identifier) {
      // Load reviewed active/suspended matches from your tenant registry.
      return identifier.value === "acme"
        ? [{ tenant: { id: "acme" }, status: "active" }]
        : [];
    },
  },
});

const app = express();
app.use(createExpressTenancyMiddleware({ manager, resolver }));
app.get("/posts", async (_request, response) => {
  const tenant = manager.getTenantOrFail();
  response.json({ tenantId: tenant.id });
});
```

Use an Express error handler to format `ExpressTenancyResolutionError`. Missing or invalid identity
maps to 400, unknown and suspended tenants share a generic 404, and ambiguous registry data maps to 500. Default errors contain no raw request identity or tenant record.

```ts
import { ExpressTenancyResolutionError } from "@tenancyjs/integration-express";

app.use((error, _request, response, next) => {
  if (error instanceof ExpressTenancyResolutionError) {
    response.status(error.statusCode).json({ error: error.code });
    return;
  }
  next(error);
});
```

## Security Boundary

- Only a `resolved` outcome enters tenant context. Failures never select central context.
- Tenant resolution establishes identity; your application still authenticates users and authorizes
  tenant membership.
- The integration never scopes database queries. Compose it with a supported adapter.
- For Prisma, expose only the client returned by `base.$extends(createPrismaTenancyExtension(...))`;
  retaining or using the base client bypasses TenancyJS isolation.
- Long-lived responses retain tenant lifecycle resources until finish, close, or abort.

See ADR-0008 and the repository security model for the complete contract.
