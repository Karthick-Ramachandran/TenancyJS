// The membership money shot, scripted and deterministic. Same logged-in user
// (a member of acme only) hits the API twice: once for acme, once spoofing the
// header to globex. Run `node provision.mjs` first.
import { createApp } from "./server.mjs";
import { TENANTS } from "./shared.mjs";

const g = (s) => `\x1b[32m${s}\x1b[0m`;
const r = (s) => `\x1b[31m${s}\x1b[0m`;
const d = (s) => `\x1b[2m${s}\x1b[0m`;
const b = (s) => `\x1b[1m${s}\x1b[0m`;
const out = (s = "") => process.stdout.write(`${s}\n`);

const { app, manager, tenancy, base, post } = await createApp();

// Seed one acme post so the authorized read returns real data. Idempotent, so
// this is safe to run after demo.mjs on the same provisioned database.
const acme = TENANTS.find((t) => t.id === "acme");
await manager.runWithTenant(acme, () =>
  tenancy.run(async (client) => {
    await client.model(post).delete({ id: "1" });
    await client.model(post).create({ id: "1", title: "Acme's roadmap" });
  }),
);

const server = app.listen(0);
const port = server.address().port;

async function get(tenantId) {
  const response = await fetch(`http://localhost:${port}/posts`, {
    headers: { "x-tenant-id": tenantId },
  });
  return { status: response.status, body: await response.json() };
}

out();
out(b("Membership - resolution is not authorization"));
out(
  d(
    "The logged-in user is a member of ACME only. The header is spoofable; membership is not.",
  ),
);
out();

const ok = await get("acme");
out(
  `  GET /posts  ${d("x-tenant-id: acme")}    -> ${g(ok.status)}  ${JSON.stringify(ok.body)}`,
);

const spoof = await get("globex");
out(
  `  GET /posts  ${d("x-tenant-id: globex")}  -> ${spoof.status === 404 ? g(spoof.status) : r(spoof.status)}  ${d(JSON.stringify(spoof.body))}`,
);
out();
out(
  spoof.status === 404
    ? g(
        b(
          "Spoofed header refused with a sanitized 404 - no cross-tenant access, no enumeration.",
        ),
      )
    : r(b(`Expected 404 for the spoofed tenant, got ${spoof.status}`)),
);
out();

server.close();
await tenancy.close();
await base.close();
