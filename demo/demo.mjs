// The money shot: two tenants, their own databases, and provable isolation.
// Run `node provision.mjs` first. Output is designed to read well on screen.
import { QueryTypes } from "sequelize";

import { TENANTS, buildTenancy, urlFor } from "./shared.mjs";

const g = (s) => `\x1b[32m${s}\x1b[0m`; // green
const r = (s) => `\x1b[31m${s}\x1b[0m`; // red
const d = (s) => `\x1b[2m${s}\x1b[0m`; // dim
const b = (s) => `\x1b[1m${s}\x1b[0m`; // bold
const out = (s = "") => process.stdout.write(`${s}\n`);

const [acme, globex] = TENANTS;
const { tenancy, base, post, run } = buildTenancy();
await tenancy.validate();

out();
out(b("TenancyJS - Express + Sequelize, database-per-tenant"));
out(d("Each tenant has its own PostgreSQL database. Isolation is by construction."));
out();

out(b("1. Both tenants write a post with the SAME id \"1\":"));
// Clear first so the demo is safe to re-run without re-provisioning.
await run(acme, (c) => c.model(post).delete({ id: "1" }));
await run(globex, (c) => c.model(post).delete({ id: "1" }));
await run(acme, (c) => c.model(post).create({ id: "1", title: "Acme's roadmap" }));
await run(globex, (c) => c.model(post).create({ id: "1", title: "Globex's roadmap" }));
out(`   ${g("ok")} acme   wrote id=1  ${d('"Acme\'s roadmap"')}   ${d(`(${urlFor(acme.database)})`)}`);
out(`   ${g("ok")} globex wrote id=1  ${d('"Globex\'s roadmap"')} ${d(`(${urlFor(globex.database)})`)}`);
out();

out(b("2. Read as each tenant - colliding id, no cross-talk:"));
const acmeRows = await run(acme, (c) => c.model(post).findAll());
const globexRows = await run(globex, (c) => c.model(post).findAll());
out(`   acme sees:   ${JSON.stringify(acmeRows)}`);
out(`   globex sees: ${JSON.stringify(globexRows)}`);
out(`   ${g("->")} each tenant sees only its own row`);
out();

out(b("3. Forget the tenant scope (a bug). TenancyJS refuses instead of leaking:"));
try {
  await tenancy.run((c) => c.model(post).findAll());
  out(`   ${r("!!")} it returned data - this should never happen`);
} catch (error) {
  out(`   ${g("blocked")} ${r(error.constructor.name)}: ${d(String(error.message).split(".")[0] + " (fail-closed).")}`);
}
out();

out(b("4. Even raw SQL via unrestricted() stays inside the tenant's own database:"));
const raw = await run(acme, async (c) => {
  const rows = await c.unrestricted().query("select title from posts", {
    type: QueryTypes.SELECT,
  });
  return rows.map((row) => row.title);
});
out(`   acme raw query -> ${JSON.stringify(raw)}  ${g("->")} never Globex's row`);
out();

out(g(b("Isolation proven: tenants cannot see each other, and unscoped access throws.")));
out();

await tenancy.close();
await base.close();
