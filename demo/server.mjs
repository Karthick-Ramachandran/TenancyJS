// The Express app. Resolution is NOT authorization: the tenant comes from the
// (spoofable) x-tenant-id header, but the request only enters a tenant scope if
// the authenticated user is a MEMBER of that tenant (ADR-0035). A spoofed header
// gets a sanitized 404 - identical to an unknown tenant, so nothing leaks.
import express from "express";
import {
  HeaderTenantResolver,
  TenantResolutionChain,
} from "tenancyjs-identifiers";
import { createExpressTenancyMiddleware } from "tenancyjs-integration-express";

import { TENANTS, buildTenancy } from "./shared.mjs";

export async function createApp() {
  const { manager, tenancy, base, post } = buildTenancy();
  await tenancy.validate();

  // The tenant directory: map a header value to a tenant record.
  const store = {
    find(identifier) {
      const tenant = TENANTS.find((t) => t.id === identifier.value);
      return tenant ? [{ tenant, status: "active" }] : [];
    },
  };

  // The chain refuses to construct without a membership decision. Here: the
  // authenticated principal must list this tenant among its memberships.
  const chain = new TenantResolutionChain({
    resolvers: [new HeaderTenantResolver({ headerName: "x-tenant-id" })],
    store,
    authorize: ({ tenant, principal }) =>
      principal?.tenantIds?.includes(tenant.id) ?? false,
  });

  const app = express();

  // Stand-in for your real auth middleware. This "logged-in user" is a member
  // of acme only. Swap in your session/JWT lookup here.
  app.use((request, _response, next) => {
    request.user = { id: "u-acme", tenantIds: ["acme"] };
    next();
  });

  app.use(
    createExpressTenancyMiddleware({
      manager,
      resolver: chain,
      principal: (request) => request.user,
    }),
  );

  app.get("/posts", async (_request, response) => {
    const rows = await tenancy.run((client) => client.model(post).findAll());
    response.json(rows);
  });

  // Translate a resolution failure into its sanitized HTTP status. forbidden and
  // not-found both surface as 404 with the same message - no tenant enumeration.
  app.use((error, _request, response, _next) => {
    if (error && typeof error.statusCode === "number") {
      response.status(error.statusCode).json({ error: error.message });
      return;
    }
    response.status(500).json({ error: "internal error" });
  });

  return { app, manager, tenancy, base, post };
}

// `node server.mjs` starts a real server you can curl.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { app } = await createApp();
  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => {
    process.stdout.write(`demo server on http://localhost:${port}\n`);
    process.stdout.write(
      `  curl -H 'x-tenant-id: acme'   localhost:${port}/posts\n`,
    );
    process.stdout.write(
      `  curl -H 'x-tenant-id: globex' localhost:${port}/posts   # 404, not a member\n`,
    );
  });
}
