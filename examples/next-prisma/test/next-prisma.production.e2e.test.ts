import { PrismaPg } from "@prisma/adapter-pg";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaClient } from "../generated/prisma/client.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describePostgres = databaseUrl === undefined ? describe.skip : describe;

describePostgres("Next + Prisma production reference", () => {
  let admin: PrismaClient;
  let server: ChildProcess;
  let origin: string;

  beforeAll(async () => {
    admin = new PrismaClient({
      adapter: new PrismaPg({ connectionString: databaseUrl }),
    });
    const port = await availablePort();
    origin = `http://127.0.0.1:${port}`;
    server = spawn(
      "pnpm",
      [
        "--filter",
        "@tenancyjs/example-next-prisma",
        "exec",
        "next",
        "start",
        "-p",
        String(port),
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: "ignore",
      },
    );
    await waitForServer(`${origin}/`);
  }, 20_000);

  beforeEach(async () => {
    await admin.post.deleteMany();
    await admin.tenant.deleteMany();
    await admin.tenant.createMany({
      data: [
        { id: "tenant-a", name: "Tenant A" },
        { id: "tenant-b", name: "Tenant B" },
        { id: "tenant-suspended", name: "Suspended", suspended: true },
      ],
    });
    await admin.post.createMany({
      data: [
        { id: "post-a", tenantId: "tenant-a", title: "A" },
        { id: "post-b", tenantId: "tenant-b", title: "B" },
      ],
    });
  });

  afterAll(async () => {
    server?.kill("SIGTERM");
    await admin?.$disconnect();
  });

  it.each(["/api/posts", "/api/action"])(
    "isolates tenant reads through %s without shared caching",
    async (path) => {
      const [responseA, responseB] = await Promise.all([
        tenantFetch(path, "tenant-a"),
        tenantFetch(path, "tenant-b"),
      ]);

      expect(responseA.status).toBe(200);
      expect(responseB.status).toBe(200);
      expect(responseA.headers.get("cache-control")).toContain("no-store");
      expect(responseB.headers.get("cache-control")).toContain("no-store");
      await expect(responseA.json()).resolves.toEqual([
        expect.objectContaining({ id: "post-a", tenantId: "tenant-a" }),
      ]);
      await expect(responseB.json()).resolves.toEqual([
        expect.objectContaining({ id: "post-b", tenantId: "tenant-b" }),
      ]);
    },
  );

  it("injects tenant ownership on writes and scopes counts", async () => {
    const created = await fetch(`${origin}/api/posts`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tenant-id": "tenant-a",
      },
      body: JSON.stringify({ title: "Created by A" }),
    });
    expect(created.status).toBe(201);
    await expect(created.json()).resolves.toMatchObject({
      tenantId: "tenant-a",
      title: "Created by A",
    });

    const [summaryA, summaryB] = await Promise.all([
      tenantFetch("/api/summary", "tenant-a"),
      tenantFetch("/api/summary", "tenant-b"),
    ]);
    await expect(summaryA.json()).resolves.toEqual({ count: 2 });
    await expect(summaryB.json()).resolves.toEqual({ count: 1 });
  });

  it.each(["/api/posts", "/api/action"])(
    "fails closed with sanitized responses through %s",
    async (path) => {
      const missing = await fetch(`${origin}${path}`);
      const unknown = await tenantFetch(path, "unknown-secret");
      const suspended = await tenantFetch(path, "tenant-suspended");

      expect(missing.status).toBe(400);
      expect(unknown.status).toBe(404);
      expect(suspended.status).toBe(404);
      expect(await unknown.json()).toEqual({
        error: "TENANCY_NEXT_RESOLUTION",
      });
      const suspendedBody = await suspended.json();
      expect(suspendedBody).toEqual({ error: "TENANCY_NEXT_RESOLUTION" });
      expect(JSON.stringify(suspendedBody)).not.toContain("suspended");
    },
  );

  function tenantFetch(path: string, tenantId: string): Promise<Response> {
    return fetch(`${origin}${path}`, { headers: { "x-tenant-id": tenantId } });
  }
});

async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Unable to allocate a production test port.");
  }
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error === undefined ? resolve() : reject(error))),
  );
  return address.port;
}

async function waitForServer(url: string): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The production process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Next production server did not become ready.");
}
