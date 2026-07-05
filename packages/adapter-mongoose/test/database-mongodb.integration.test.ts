import { TenancyManager } from "tenancyjs-core";
import {
  createConnection,
  type Connection,
  type Model,
  Schema,
} from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  MongooseTenancyConfigurationError,
  createMongooseTenancy,
} from "../src/index.js";

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

  // ADR-0033: the leased Connection is the tenant's own database, so raw finds
  // and $lookup aggregations (Mongo's join) cannot reach another tenant.
  it("unrestricted() Connection stays inside the tenant's own database", async () => {
    await run(tenantA, (client) =>
      client.model(model()).create({ _id: "u", title: "A" }),
    );
    await run(tenantB, (client) =>
      client.model(model()).create({ _id: "u", title: "B" }),
    );
    const titlesA = await run(tenantA, async (client) => {
      const docs = await client
        .unrestricted()
        .model<Post>("Post")
        .find({ _id: "u" })
        .lean();
      return docs.map((doc) => doc.title);
    });
    expect(titlesA).toEqual(["A"]); // never tenant B's colliding doc
    const joinB = await run(tenantB, async (client) => {
      const docs = await client
        .unrestricted()
        .model<Post>("Post")
        .aggregate<{ title: string }>([
          { $match: { _id: "u" } },
          {
            $lookup: {
              from: "posts",
              localField: "_id",
              foreignField: "_id",
              as: "self",
            },
          },
        ]);
      return docs.map((doc) => doc.title);
    });
    expect(joinB).toEqual(["B"]);
  });

  it("reports database-enforced capabilities for database-per-tenant", () => {
    expect(tenancy.capabilities.nestedReads).toBe("supported");
    expect(tenancy.capabilities.nestedWrites).toBe("supported");
    expect(tenancy.capabilities.rawQueries).toBe("supported");
  });

  it("refuses unrestricted() in central mode — it runs on the shared base connection", async () => {
    // Central mode uses the shared base connection, not a leased tenant database,
    // so the raw handle must stay fail-closed (ADR-0033) — the same leak vector
    // guarded in every adapter.
    await expect(
      manager.runInCentralContext(() =>
        tenancy.run(async (client) => client.unrestricted()),
      ),
    ).rejects.toBeInstanceOf(MongooseTenancyConfigurationError);
  });
});
