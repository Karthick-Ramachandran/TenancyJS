// Provision the two tenant databases and their `posts` table.
// Idempotent: drops and recreates, so the demo always starts clean.
import pg from "pg";

import { ADMIN_URL, TENANTS, makeSequelize, urlFor } from "./shared.mjs";

const { Client } = pg;

async function recreateDatabase(name) {
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  // CREATE/DROP DATABASE cannot run in a transaction; use the admin connection.
  await admin.query(`drop database if exists ${name} with (force)`);
  await admin.query(`create database ${name}`);
  await admin.end();
}

async function createSchema(database) {
  const sequelize = makeSequelize(urlFor(database));
  await sequelize.models.Post.sync();
  await sequelize.close();
}

for (const tenant of TENANTS) {
  await recreateDatabase(tenant.database);
  await createSchema(tenant.database);
  process.stdout.write(
    `  provisioned ${tenant.id} -> database ${tenant.database}\n`,
  );
}

process.stdout.write("done\n");
