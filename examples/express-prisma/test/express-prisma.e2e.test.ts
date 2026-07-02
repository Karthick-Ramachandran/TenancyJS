import { PrismaPg } from "@prisma/adapter-pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createExpressPrismaApp } from "../src/app.js";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createExampleRuntime, type ExampleTenant } from "../src/runtime.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describePostgres = databaseUrl === undefined ? describe.skip : describe;

describePostgres("Express + Prisma PostgreSQL reference", () => {
  let admin: PrismaClient;
  let runtime: ReturnType<typeof createExampleRuntime>;

  beforeAll(() => {
    admin = new PrismaClient({
      adapter: new PrismaPg({ connectionString: databaseUrl }),
    });
    runtime = createExampleRuntime(databaseUrl!);
  });

  beforeEach(async () => {
    await admin.post.deleteMany();
    await admin.tenant.deleteMany();
    await admin.tenant.createMany({
      data: [
        { id: "tenant-a", name: "Tenant A" },
        { id: "tenant-b", name: "Tenant B" },
      ],
    });
  });

  afterAll(async () => {
    await runtime.disconnect();
    await admin.$disconnect();
  });

  it("isolates reads, counts, and aggregates through HTTP", async () => {
    await seedPosts([
      { id: "post-a", tenantId: "tenant-a", title: "A" },
      { id: "post-b", tenantId: "tenant-b", title: "B" },
    ]);
    const app = createExpressPrismaApp(runtime);

    const postsA = await request(app)
      .get("/posts")
      .set("x-tenant-id", "tenant-a")
      .expect(200);
    const postsB = await request(app)
      .get("/posts")
      .set("x-tenant-id", "tenant-b")
      .expect(200);
    const summaryA = await request(app)
      .get("/summary")
      .set("x-tenant-id", "tenant-a")
      .expect(200);

    expect(postsA.body).toEqual([
      expect.objectContaining({ id: "post-a", tenantId: "tenant-a" }),
    ]);
    expect(postsB.body).toEqual([
      expect.objectContaining({ id: "post-b", tenantId: "tenant-b" }),
    ]);
    expect(summaryA.body).toEqual({ count: 1, aggregateCount: 1 });
  });

  it("injects the active tenant and prevents cross-tenant update and delete", async () => {
    await seedPosts([
      { id: "post-a", tenantId: "tenant-a", title: "A" },
      { id: "post-b", tenantId: "tenant-b", title: "B" },
    ]);
    const app = createExpressPrismaApp(runtime);

    const created = await request(app)
      .post("/posts")
      .set("x-tenant-id", "tenant-a")
      .send({ title: "created by A" })
      .expect(201);
    expect(created.body).toMatchObject({
      tenantId: "tenant-a",
      title: "created by A",
    });

    await request(app)
      .patch("/posts/post-b")
      .set("x-tenant-id", "tenant-a")
      .send({ title: "stolen" })
      .expect(404, { error: "NOT_FOUND" });
    await request(app)
      .delete("/posts/post-b")
      .set("x-tenant-id", "tenant-a")
      .expect(404, { error: "NOT_FOUND" });

    await expect(
      admin.post.findUnique({ where: { id: "post-b" } }),
    ).resolves.toMatchObject({
      tenantId: "tenant-b",
      title: "B",
    });
  });

  it("allows tenant-owned mutation without affecting another tenant", async () => {
    await seedPosts([
      { id: "post-a", tenantId: "tenant-a", title: "A" },
      { id: "post-b", tenantId: "tenant-b", title: "B" },
    ]);
    const app = createExpressPrismaApp(runtime);

    await request(app)
      .patch("/posts/post-a")
      .set("x-tenant-id", "tenant-a")
      .send({ title: "updated A" })
      .expect(200);
    await request(app)
      .delete("/posts/post-a")
      .set("x-tenant-id", "tenant-a")
      .expect(204);

    await expect(admin.post.findMany()).resolves.toEqual([
      expect.objectContaining({
        id: "post-b",
        tenantId: "tenant-b",
        title: "B",
      }),
    ]);
  });

  it("fails closed for missing and unknown identity without exposing input", async () => {
    const app = createExpressPrismaApp(runtime);

    await request(app)
      .get("/posts")
      .expect(400, { error: "TENANCY_EXPRESS_RESOLUTION" });
    const unknown = await request(app)
      .get("/posts")
      .set("x-tenant-id", "unknown-secret")
      .expect(404);

    expect(unknown.body).toEqual({ error: "TENANCY_EXPRESS_RESOLUTION" });
    expect(JSON.stringify(unknown.body)).not.toContain("unknown-secret");
  });

  async function seedPosts(
    posts: readonly (Pick<ExampleTenant, "id"> & {
      readonly tenantId: string;
      readonly title: string;
    })[],
  ): Promise<void> {
    await admin.post.createMany({ data: [...posts] });
  }
});
