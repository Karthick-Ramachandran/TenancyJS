import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import pg from "pg";

import {
  createPostgresDatabaseProvisioner,
  createPostgresSchemaProvisioner,
} from "../src/index.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl === undefined ? describe.skip : describe;

const SCHEMA = "tenancyjs_prov_schema_test";
const DATABASE = "tenancyjs_prov_db_test";

suite("PostgreSQL provisioners against a real database", () => {
  let admin: pg.Client;

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: databaseUrl });
    await admin.connect();
    await admin.query(`drop schema if exists "${SCHEMA}" cascade`);
    await admin.query(`drop database if exists "${DATABASE}" with (force)`);
  });

  afterAll(async () => {
    await admin.query(`drop schema if exists "${SCHEMA}" cascade`);
    await admin.query(`drop database if exists "${DATABASE}" with (force)`);
    await admin.end();
  });

  it("provisions, migrates, and deprovisions a schema idempotently", async () => {
    const migrate = vi.fn(async () => {});
    const provisioner = createPostgresSchemaProvisioner({
      admin,
      schema: () => SCHEMA,
      migrate,
    });

    await provisioner.provision!({ id: "acme" });
    await provisioner.provision!({ id: "acme" }); // idempotent
    const present = await admin.query(
      "select 1 from information_schema.schemata where schema_name = $1",
      [SCHEMA],
    );
    expect(present.rows).toHaveLength(1);

    await provisioner.migrate!({ id: "acme" });
    expect(migrate).toHaveBeenCalledWith({ id: "acme" }, { schema: SCHEMA });

    await provisioner.deprovision!({ id: "acme" });
    const gone = await admin.query(
      "select 1 from information_schema.schemata where schema_name = $1",
      [SCHEMA],
    );
    expect(gone.rows).toHaveLength(0);
  });

  it("provisions a database only when absent, then deprovisions it", async () => {
    const provisioner = createPostgresDatabaseProvisioner({
      admin,
      database: () => DATABASE,
    });

    await provisioner.provision!({ id: "acme" });
    await provisioner.provision!({ id: "acme" }); // no-op when it already exists
    const present = await admin.query(
      "select 1 from pg_database where datname = $1",
      [DATABASE],
    );
    expect(present.rows).toHaveLength(1);

    await provisioner.deprovision!({ id: "acme" });
    const gone = await admin.query(
      "select 1 from pg_database where datname = $1",
      [DATABASE],
    );
    expect(gone.rows).toHaveLength(0);
  });
});
