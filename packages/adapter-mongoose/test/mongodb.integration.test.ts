import { TenancyManager } from "tenancyjs-core";
import {
  createConnection,
  type Connection,
  type Model,
  Schema,
} from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createMongooseTenancy } from "../src/index.js";

const mongoUrl = process.env.TEST_MONGODB_URL;
const describeMongo =
  mongoUrl === undefined ? describe.skip : describe.sequential;
const database = `tenancyjs_mongoose_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;

interface Tenant {
  readonly id: string;
}

interface Post {
  id: string;
  tenantId: string;
  title: string;
}

describeMongo("Mongoose MongoDB row-level isolation", () => {
  let connection: Connection;
  let PostModel: Model<Post>;
  let manager: TenancyManager<Tenant>;
  let tenancy: ReturnType<typeof createMongooseTenancy<Tenant>>;

  beforeAll(async () => {
    const url = new URL(mongoUrl!);
    url.pathname = `/${database}`;
    connection = await createConnection(url.toString()).asPromise();
    const schema = new Schema<Post>(
      {
        id: { type: String, required: true },
        tenantId: { type: String, required: true },
        title: { type: String, required: true },
      },
      { versionKey: false },
    );
    schema.index({ tenantId: 1, id: 1 }, { unique: true });
    PostModel = connection.model<Post>("Post", schema, "posts");
    await PostModel.createCollection();
    await PostModel.syncIndexes();
    manager = new TenancyManager<Tenant>();
    tenancy = createMongooseTenancy({
      manager,
      connection,
      tenantModels: [{ model: PostModel as unknown as Model<unknown> }],
    });
    await tenancy.validate();
  });

  beforeEach(async () => {
    await PostModel.deleteMany({});
  });

  afterAll(async () => {
    if (connection !== undefined) {
      await connection.dropDatabase();
      await connection.close();
    }
  });

  const tenantA: Tenant = { id: "tenant-a" };
  const tenantB: Tenant = { id: "tenant-b" };

  function run<TResult>(
    tenant: Tenant,
    callback: Parameters<typeof tenancy.run<TResult>>[0],
  ): Promise<TResult> {
    return manager.runWithTenant(tenant, () => tenancy.run(callback));
  }

  it("isolates colliding logical ids across CRUD and count", async () => {
    const model = PostModel as unknown as Model<unknown>;
    await run(tenantA, (client) =>
      client.model(model).create({ id: "same-id", title: "A" }),
    );
    await run(tenantB, (client) =>
      client.model(model).create({ id: "same-id", title: "B" }),
    );
    await expect(
      run(tenantA, (client) => client.model(model).find()),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "same-id",
        tenantId: "tenant-a",
        title: "A",
      }),
    ]);
    await expect(
      run(tenantA, (client) =>
        client.model(model).update({ id: "same-id" }, { title: "A2" }),
      ),
    ).resolves.toBe(1);
    await expect(
      run(tenantB, (client) => client.model(model).findOne({ id: "same-id" })),
    ).resolves.toMatchObject({ title: "B" });
    await expect(
      run(tenantA, (client) => client.model(model).delete({ id: "same-id" })),
    ).resolves.toBe(1);
    await expect(
      run(tenantB, (client) => client.model(model).count()),
    ).resolves.toBe(1);
  });

  it("rolls back callback failures and supports concurrent tenant sessions", async () => {
    const model = PostModel as unknown as Model<unknown>;
    const failure = new Error("rollback");
    await expect(
      run(tenantA, async (client) => {
        await client.model(model).create({ id: "rolled-back", title: "A" });
        throw failure;
      }),
    ).rejects.toBe(failure);
    await expect(
      run(tenantA, (client) => client.model(model).count()),
    ).resolves.toBe(0);
    await Promise.all([
      run(tenantA, (client) =>
        client.model(model).create({ id: "a", title: "A" }),
      ),
      run(tenantB, (client) =>
        client.model(model).create({ id: "b", title: "B" }),
      ),
    ]);
    await expect(
      run(tenantA, (client) => client.model(model).count()),
    ).resolves.toBe(1);
    await expect(
      run(tenantB, (client) => client.model(model).count()),
    ).resolves.toBe(1);
  });
});
