// The money shot: two tenants, their own databases, provable isolation.
// Run `node provision.mjs` first. Self-paced so it reads as a story on screen.
import { setTimeout as sleep } from "node:timers/promises";

import { TENANTS, buildTenancy } from "./shared.mjs";

const g = (s) => `\x1b[32m${s}\x1b[0m`; // green
const r = (s) => `\x1b[31m${s}\x1b[0m`; // red
const d = (s) => `\x1b[2m${s}\x1b[0m`; // dim
const b = (s) => `\x1b[1m${s}\x1b[0m`; // bold
const out = (s = "") => process.stdout.write(`${s}\n`);
const beat = () => sleep(1300);

const [acme, globex] = TENANTS;
const { tenancy, base, post, run } = buildTenancy();
await tenancy.validate();

out();
out(`  ${b("TenancyJS")} ${d("· Express + Sequelize · database-per-tenant")}`);
out(`  ${d("Two tenants. Each gets its own PostgreSQL database.")}`);
out();
await beat();

// Same primary key in each tenant - a classic way to catch a leak.
await run(acme, (c) => c.model(post).delete({ id: "1" }));
await run(globex, (c) => c.model(post).delete({ id: "1" }));
out(`  ${b("Both tenants write a post with the same id (1):")}`);
await run(acme, (c) => c.model(post).create({ id: "1", title: "Acme roadmap" }));
out(`    ${g("✓")} acme   → ${b('"Acme roadmap"')}`);
await run(globex, (c) => c.model(post).create({ id: "1", title: "Globex roadmap" }));
out(`    ${g("✓")} globex → ${b('"Globex roadmap"')}`);
out();
await beat();

out(`  ${b("Read back — same id, zero cross-talk:")}`);
const acmeRows = await run(acme, (c) => c.model(post).findAll());
const globexRows = await run(globex, (c) => c.model(post).findAll());
out(`    acme   sees  ${g(JSON.stringify(acmeRows.map((row) => row.title)))}`);
out(`    globex sees  ${g(JSON.stringify(globexRows.map((row) => row.title)))}`);
out();
await beat();

out(`  ${b("Forget the tenant scope — the bug that usually leaks everything:")}`);
try {
  await tenancy.run((c) => c.model(post).findAll());
  out(`    ${r("!! it returned data — this should never happen")}`);
} catch (error) {
  out(`    ${r("✗")} ${r(error.name)} ${d("— refused, not leaked (fail-closed)")}`);
}
out();
await beat();

out(`  ${g(b("Tenants can't see each other. You verify — you don't trust."))}`);
out();

await tenancy.close();
await base.close();
