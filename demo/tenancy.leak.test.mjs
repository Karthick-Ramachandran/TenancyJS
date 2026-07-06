// Leak test for `tenancy test:leak`. Provisions two tenants, writes a colliding
// row to each, and asserts no cross-tenant read and fail-closed unscoped access.
// Exits 0 only if isolation holds. Receives DATABASE_URL / TEST_DATABASE_URL.
import assert from "node:assert/strict";

import pg from "pg";

import { ADMIN_URL, TENANTS, buildTenancy, makeSequelize, urlFor } from "./shared.mjs";

const { Client } = pg;

async function provision(name) {
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${name} with (force)`);
  await admin.query(`create database ${name}`);
  await admin.end();
  const sequelize = makeSequelize(urlFor(name));
  await sequelize.models.Post.sync();
  await sequelize.close();
}

const [acme, globex] = TENANTS;
for (const tenant of TENANTS) await provision(tenant.database);

const { tenancy, base, post, run } = buildTenancy();
await tenancy.validate();

// Colliding primary keys in separate databases.
await run(acme, (c) => c.model(post).create({ id: "1", title: "acme" }));
await run(globex, (c) => c.model(post).create({ id: "1", title: "globex" }));

// No cross-tenant reads.
const acmeRows = await run(acme, (c) => c.model(post).findAll());
const globexRows = await run(globex, (c) => c.model(post).findAll());
assert.deepEqual(acmeRows, [{ id: "1", title: "acme" }], "acme saw foreign rows");
assert.deepEqual(globexRows, [{ id: "1", title: "globex" }], "globex saw foreign rows");

// Unscoped access must fail closed, not return data.
await assert.rejects(
  () => tenancy.run((c) => c.model(post).findAll()),
  /tenant/i,
  "unscoped access did not fail closed",
);

await tenancy.close();
await base.close();

process.stdout.write("PASS: tenants are isolated and unscoped access is refused.\n");
