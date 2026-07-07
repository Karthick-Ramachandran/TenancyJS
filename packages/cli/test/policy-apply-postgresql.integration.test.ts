import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

import { generatePolicySql } from "../src/commands/policy.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl === undefined ? describe.skip : describe;

const TABLE = "policy_apply_test";

suite("policy DDL applies to a real PostgreSQL table", () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    await client.query(`drop table if exists ${TABLE}`);
    await client.query(
      `create table ${TABLE} (id text primary key, tenant_id text not null)`,
    );
  });

  afterAll(async () => {
    await client.query(`drop table if exists ${TABLE}`);
    await client.end();
  });

  it("enables forced RLS and creates the reviewed policy, idempotently", async () => {
    const sql = generatePolicySql({ tables: [TABLE], role: "postgres" });

    // The exact DDL `tenancy policy` prints must be valid, applicable SQL.
    await client.query(sql);
    await client.query(sql); // DROP POLICY IF EXISTS makes it idempotent.

    const forced = await client.query(
      "select relforcerowsecurity as forced, relrowsecurity as enabled from pg_class where relname = $1",
      [TABLE],
    );
    expect(forced.rows[0]).toMatchObject({ forced: true, enabled: true });

    const policy = await client.query(
      `select 1 from pg_policy p join pg_class c on c.oid = p.polrelid
       where c.relname = $1 and p.polname = $2`,
      [TABLE, `${TABLE}_tenant_isolation`],
    );
    expect(policy.rows).toHaveLength(1);
  });
});
