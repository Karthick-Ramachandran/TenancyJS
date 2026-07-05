import { PrismaPg } from "@prisma/adapter-pg";
import { TenancyManager } from "tenancyjs-core";
import knex, { type Knex } from "knex";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaClient } from "../../../.artifacts/prisma/adapter-prisma/client.js";
import { createPrismaSchemaTenancy } from "../src/index.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describePostgres = databaseUrl === undefined ? describe.skip : describe;
const suffix = `${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
const schemaA = `prisma_spt_a_${suffix}`;
const schemaB = `prisma_spt_b_${suffix}`;

interface SchemaTenant {
  readonly id: string;
  readonly schema: string;
}

describePostgres("Prisma PostgreSQL schema-per-tenant isolation", () => {
  let admin: Knex;
  let manager: TenancyManager<SchemaTenant>;
  let tenancy: ReturnType<
    typeof createPrismaSchemaTenancy<SchemaTenant, PrismaClient>
  >;

  beforeAll(async () => {
    admin = knex({ client: "pg", connection: databaseUrl! });
    for (const schema of [schemaA, schemaB]) {
      await admin.schema.createSchema(schema);
      await admin.schema.withSchema(schema).createTable("Post", (table) => {
        table.text("id").primary();
        table.text("tenantId").notNullable();
        table.text("title").notNullable();
        table.boolean("published").notNullable().defaultTo(false);
      });
    }
    manager = new TenancyManager<SchemaTenant>();
    tenancy = createPrismaSchemaTenancy<SchemaTenant, PrismaClient>({
      manager,
      schema: (tenant) => ({
        key: tenant.schema,
        create: () =>
          new PrismaClient({
            adapter: new PrismaPg(
              { connectionString: databaseUrl! },
              { schema: tenant.schema },
            ),
          }),
      }),
      disconnect: (client) => client.$disconnect(),
    });
  });

  beforeEach(async () => {
    for (const schema of [schemaA, schemaB]) {
      await admin.withSchema(schema).table("Post").delete();
    }
  });

  afterAll(async () => {
    await tenancy?.close();
    if (admin !== undefined) {
      await admin.schema.dropSchemaIfExists(schemaA, true);
      await admin.schema.dropSchemaIfExists(schemaB, true);
      await admin.destroy();
    }
  });

  const tenantA: SchemaTenant = { id: "tenant-a", schema: schemaA };
  const tenantB: SchemaTenant = { id: "tenant-b", schema: schemaB };

  function run<TResult>(
    tenant: SchemaTenant,
    callback: (client: PrismaClient) => Promise<TResult>,
  ): Promise<TResult> {
    return manager.runWithTenant(tenant, () => tenancy.run(callback));
  }

  it("routes colliding ids to distinct schemas and blocks cross-tenant mutation", async () => {
    await run(tenantA, (client) =>
      client.post.create({
        data: { id: "same-id", tenantId: "tenant-a", title: "A" },
      }),
    );
    await run(tenantB, (client) =>
      client.post.create({
        data: { id: "same-id", tenantId: "tenant-b", title: "B" },
      }),
    );

    await expect(
      run(tenantA, (client) => client.post.findMany()),
    ).resolves.toEqual([
      expect.objectContaining({ id: "same-id", title: "A" }),
    ]);
    await expect(
      run(tenantB, (client) => client.post.findMany()),
    ).resolves.toEqual([
      expect.objectContaining({ id: "same-id", title: "B" }),
    ]);

    await run(tenantA, (client) =>
      client.post.update({
        where: { id: "same-id" },
        data: { title: "A2" },
      }),
    );
    await expect(
      admin.withSchema(schemaB).table("Post").where("id", "same-id").first(),
    ).resolves.toMatchObject({ title: "B" });
  });

  it("rejects tenant-to-schema collisions through the public router", async () => {
    await run(tenantA, (client) => client.post.count());
    await expect(
      run({ id: "tenant-c", schema: schemaA }, (client) => client.post.count()),
    ).rejects.toMatchObject({ code: "TENANCY_RESOURCE_CACHE_COLLISION" });
  });
});
