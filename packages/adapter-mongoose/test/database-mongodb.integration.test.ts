import { TenancyManager } from "tenancyjs-core";
import {
  createConnection,
  type Connection,
  type Model,
  Schema,
} from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createMongooseTenancy } from "../src/index.js";

const mongoUrl = process.env.TEST_MONGODB_URL;
const describeMongo = mongoUrl === undefined ? describe.skip : describe;
const suffix = `${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
const databaseA = `mongoose_dpt_a_${suffix}`;
const databaseB = `mongoose_dpt_b_${suffix}`;
const baseDatabase = `mongoose_dpt_base_${suffix}`;

interface Tenant {
  readonly id: string;
  readonly database: string;
}

interface Post {
  _id: string;
  title: string;
}

const postSchema = new Schema<Post>(
  {
    _id: { type: String },
    title: { type: String, required: true },
  },
  { versionKey: false },
);

function urlFor(database: string): string {
  const url = new URL(mongoUrl!);
  url.pathname = `/${database}`;
  return url.toString();
}

async function createTenantConnection(database: string): Promise<Connection> {
  const connection = await createConnection(urlFor(database)).asPromise();
  connection.model<Post>("Post", postSchema, "posts");
  return connection;
}

describeMongo("Mongoose MongoDB database-per-tenant isolation", () => {
  const manager = new TenancyManager<Tenant>();
  let base: Connection;
  let basePost: Model<Post>;
  let tenancy: ReturnType<typeof createMongooseTenancy<Tenant>>;

  beforeAll(async () => {
    base = await createConnection(urlFor(baseDatabase)).asPromise();
    basePost = base.model<Post>("Post", postSchema, "posts");
    tenancy = createMongooseTenancy({
      manager,
      connection: base,
      strategy: "databasePerTenant",
      tenantModels: [{ model: basePost as unknown as Model<unknown> }],
      database: (tenant) => ({
        key: tenant.database,
        create: () => createTenantConnection(tenant.database),
      }),
    });
    await expect(tenancy.validate()).resolves.toMatchObject({ valid: true });
  });

  afterAll(async () => {
    await tenancy?.close();
    for (const database of [databaseA, databaseB]) {
      const connection = await createConnection(urlFor(database)).asPromise();
      await connection.dropDatabase();
      await connection.close();
    }
    if (base !== undefined) {
      await base.dropDatabase();
      await base.close();
    }
  });

  const tenantA: Tenant = { id: "tenant-a", database: databaseA };
  const tenantB: Tenant = { id: "tenant-b", database: databaseB };
  const model = () => basePost as unknown as Model<unknown>;
  const run = <T>(
    tenant: Tenant,
    callback: Parameters<typeof tenancy.run<T>>[0],
  ) => manager.runWithTenant(tenant, () => tenancy.run(callback));

  it("keeps colliding _id values isolated across databases", async () => {
    await run(tenantA, (client) =>
      client.model(model()).create({ _id: "same-id", title: "A" }),
    );
    await run(tenantB, (client) =>
      client.model(model()).create({ _id: "same-id", title: "B" }),
    );

    await expect(
      run(tenantA, (client) => client.model(model()).find()),
    ).resolves.toEqual([{ _id: "same-id", title: "A" }]);
    await run(tenantA, (client) =>
      client.model(model()).update({ _id: "same-id" }, { title: "A2" }),
    );
    await expect(
      run(tenantB, (client) =>
        client.model(model()).findOne({ _id: "same-id" }),
      ),
    ).resolves.toEqual({ _id: "same-id", title: "B" });
  });

  it("rejects two tenants resolving to the same database placement", async () => {
    await run(tenantA, (client) => client.model(model()).count());
    await expect(
      run({ id: "tenant-c", database: databaseA }, (client) =>
        client.model(model()).count(),
      ),
    ).rejects.toMatchObject({ code: "TENANCY_RESOURCE_CACHE_COLLISION" });
  });
});
