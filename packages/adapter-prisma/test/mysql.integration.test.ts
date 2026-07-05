import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { TenantContextError, TenancyManager } from "tenancyjs-core";
import { createRowLevelAdapterContract } from "tenancyjs-testing";
import type {
  RowLevelAdapterContractHarness,
  RowLevelAdapterContractOperations,
} from "tenancyjs-testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaClient } from "../../../.artifacts/prisma/adapter-prisma-mysql/client.js";
import {
  PrismaTenantFieldConflictError,
  PrismaUnsupportedOperationError,
  createPrismaTenancyExtension,
} from "../src/index.js";

const databaseUrl = process.env.MYSQL_TEST_DATABASE_URL;
const describeMysql = databaseUrl === undefined ? describe.skip : describe;

describeMysql("Prisma MySQL row-level isolation", () => {
  const manager = new TenancyManager();
  let base: PrismaClient;

  beforeAll(() => {
    const adapter = new PrismaMariaDb(databaseUrl as string);
    base = new PrismaClient({ adapter });
  });

  beforeEach(async () => {
    await base.comment.deleteMany();
    await base.post.deleteMany();
    await base.tenant.deleteMany();
    await base.tenant.createMany({
      data: [
        { id: "tenant-a", name: "Tenant A" },
        { id: "tenant-b", name: "Tenant B" },
      ],
    });
  });

  afterAll(async () => {
    await base.$disconnect();
  });

  function client() {
    return base.$extends(
      createPrismaTenancyExtension({
        manager,
        tenantModels: {
          Post: { relationFields: ["comments"] },
          Comment: { relationFields: ["post"] },
        },
        centralModels: { Tenant: {} },
      }),
    );
  }

  function scopedPostData<TData extends Record<string, unknown>>(
    data: TData,
  ): TData & { tenantId: string } {
    return { tenantId: manager.getTenantOrFail().id, ...data };
  }

  function contractHarness(): RowLevelAdapterContractHarness {
    const prisma = client();
    return {
      async reset() {
        await base.comment.deleteMany();
        await base.post.deleteMany();
      },
      async seed(records) {
        await base.post.createMany({
          data: records.map((record) => ({
            id: record.id,
            tenantId: record.tenantId,
            title: record.value,
          })),
        });
      },
      runWithTenant(tenantId, callback) {
        return manager.runWithTenant({ id: tenantId }, callback);
      },
      runInCentralContext(callback) {
        return manager.runInCentralContext(callback);
      },
      async create(input) {
        const post = await prisma.post.create({
          data: scopedPostData({
            id: input.id,
            title: input.value,
            ...(input.tenantId === undefined
              ? {}
              : { tenantId: input.tenantId }),
          }),
        });
        return { id: post.id, tenantId: post.tenantId, value: post.title };
      },
      async findMany() {
        const posts = await prisma.post.findMany({ orderBy: { id: "asc" } });
        return posts.map((post) => ({
          id: post.id,
          tenantId: post.tenantId,
          value: post.title,
        }));
      },
      count() {
        return prisma.post.count();
      },
      async updateMany(value) {
        return (await prisma.post.updateMany({ data: { title: value } })).count;
      },
      async deleteMany() {
        return (await prisma.post.deleteMany()).count;
      },
      transaction(callback) {
        return prisma.$transaction(async (transaction) => {
          const operations: RowLevelAdapterContractOperations = {
            async create(input) {
              const post = await transaction.post.create({
                data: scopedPostData({
                  id: input.id,
                  title: input.value,
                  ...(input.tenantId === undefined
                    ? {}
                    : { tenantId: input.tenantId }),
                }),
              });
              return {
                id: post.id,
                tenantId: post.tenantId,
                value: post.title,
              };
            },
            async findMany() {
              const posts = await transaction.post.findMany({
                orderBy: { id: "asc" },
              });
              return posts.map((post) => ({
                id: post.id,
                tenantId: post.tenantId,
                value: post.title,
              }));
            },
            count() {
              return transaction.post.count();
            },
            async updateMany(value) {
              return (
                await transaction.post.updateMany({ data: { title: value } })
              ).count;
            },
            async deleteMany() {
              return (await transaction.post.deleteMany()).count;
            },
          };
          return callback(operations);
        });
      },
    };
  }

  for (const contractCase of createRowLevelAdapterContract(contractHarness)) {
    it(`shared contract: ${contractCase.name}`, contractCase.run);
  }

  it("isolates create, unique/many reads, counts, aggregates, and grouping", async () => {
    const prisma = client();
    const postA = await manager.runWithTenant({ id: "tenant-a" }, () =>
      prisma.post.create({
        data: scopedPostData({ title: "A", published: true }),
      }),
    );
    const postB = await manager.runWithTenant({ id: "tenant-b" }, () =>
      prisma.post.create({ data: scopedPostData({ title: "B" }) }),
    );

    await manager.runWithTenant({ id: "tenant-a" }, async () => {
      await expect(prisma.post.findMany()).resolves.toEqual([postA]);
      await expect(
        prisma.post.findUnique({ where: { id: postB.id } }),
      ).resolves.toBeNull();
      await expect(prisma.post.count()).resolves.toBe(1);
      await expect(
        prisma.post.aggregate({ _count: true }),
      ).resolves.toMatchObject({ _count: 1 });
      await expect(
        prisma.post.groupBy({ by: ["published"], _count: true }),
      ).resolves.toEqual([{ published: true, _count: 1 }]);
    });
  });

  // MySQL does not support SQL RETURNING, so Prisma's createManyAndReturn /
  // updateManyAndReturn are unavailable there (a Prisma/MySQL limitation, not a
  // tenancy gap); the bulk create/update/delete isolation is covered by the
  // shared contract and the cross-tenant tests below.

  it("cannot update, delete, or upsert across tenant boundaries", async () => {
    const prisma = client();
    const postB = await manager.runWithTenant({ id: "tenant-b" }, () =>
      prisma.post.create({ data: scopedPostData({ title: "B" }) }),
    );

    await manager.runWithTenant({ id: "tenant-a" }, async () => {
      await expect(
        prisma.post.update({
          where: { id: postB.id },
          data: { title: "stolen" },
        }),
      ).rejects.toMatchObject({ code: "P2025" });
      await expect(
        prisma.post.delete({ where: { id: postB.id } }),
      ).rejects.toMatchObject({ code: "P2025" });
      await expect(
        prisma.post.upsert({
          where: { id: postB.id },
          create: scopedPostData({ id: postB.id, title: "collision" }),
          update: { title: "stolen" },
        }),
      ).rejects.toBeDefined();
    });

    await expect(
      base.post.findUnique({ where: { id: postB.id } }),
    ).resolves.toMatchObject({ tenantId: "tenant-b", title: "B" });
  });

  it("fails without context and rejects tenant discriminator tampering", async () => {
    const prisma = client();

    await expect(prisma.post.findMany()).rejects.toBeInstanceOf(
      TenantContextError,
    );
    await expect(
      manager.runWithTenant({ id: "tenant-a" }, () =>
        prisma.post.create({
          data: { title: "bad", tenantId: "tenant-b" },
        }),
      ),
    ).rejects.toBeInstanceOf(PrismaTenantFieldConflictError);
    await expect(
      manager.runWithTenant({ id: "tenant-a" }, () =>
        prisma.post.updateMany({ data: { tenantId: "tenant-a" } }),
      ),
    ).rejects.toBeInstanceOf(PrismaTenantFieldConflictError);
  });

  it("allows allowlisted central models and explicit central context", async () => {
    const prisma = client();
    await expect(prisma.tenant.count()).resolves.toBe(2);

    await manager.runWithTenant({ id: "tenant-a" }, () =>
      prisma.post.create({ data: scopedPostData({ title: "A" }) }),
    );
    await manager.runWithTenant({ id: "tenant-b" }, () =>
      prisma.post.create({ data: scopedPostData({ title: "B" }) }),
    );

    await expect(
      manager.runInCentralContext(() => prisma.post.count()),
    ).resolves.toBe(2);
  });

  it("rejects raw and nested relation operations on the extended client", async () => {
    const prisma = client();
    const post = await base.post.create({
      data: { tenantId: "tenant-a", title: "relation-root" },
    });
    await base.comment.create({
      data: {
        tenantId: "tenant-b",
        postId: post.id,
        body: "cross-tenant relation",
      },
    });

    await expect(prisma.$queryRaw`SELECT 1`).rejects.toBeInstanceOf(
      PrismaUnsupportedOperationError,
    );
    await expect(
      manager.runWithTenant({ id: "tenant-a" }, () =>
        prisma.post.findMany({ include: { comments: true } }),
      ),
    ).rejects.toBeInstanceOf(PrismaUnsupportedOperationError);
    await expect(
      manager.runWithTenant({ id: "tenant-a" }, () =>
        prisma.post.findUnique({ where: { id: post.id } }).comments(),
      ),
    ).rejects.toBeInstanceOf(PrismaUnsupportedOperationError);
    await expect(
      manager.runWithTenant({ id: "tenant-a" }, () =>
        prisma.post.create({
          data: scopedPostData({
            title: "nested",
            comments: {
              create: { body: "unsafe", tenantId: "tenant-a" },
            },
          }),
        }),
      ),
    ).rejects.toBeInstanceOf(PrismaUnsupportedOperationError);
  });

  it("preserves tenant scope in interactive and batch transactions", async () => {
    const prisma = client();

    await manager.runWithTenant({ id: "tenant-a" }, async () => {
      await prisma.$transaction(async (transaction) => {
        await transaction.post.create({
          data: scopedPostData({ title: "interactive" }),
        });
        await expect(transaction.post.count()).resolves.toBe(1);
      });

      const [, count] = await prisma.$transaction([
        prisma.post.create({ data: scopedPostData({ title: "batch" }) }),
        prisma.post.count(),
      ]);
      expect(count).toBe(2);
    });

    await expect(
      base.post.findMany({ orderBy: { title: "asc" } }),
    ).resolves.toEqual([
      expect.objectContaining({ tenantId: "tenant-a", title: "batch" }),
      expect.objectContaining({ tenantId: "tenant-a", title: "interactive" }),
    ]);
  });

  it("rolls back a failed interactive transaction", async () => {
    const prisma = client();

    await expect(
      manager.runWithTenant({ id: "tenant-a" }, () =>
        prisma.$transaction(async (transaction) => {
          await transaction.post.create({
            data: scopedPostData({ title: "rolled-back" }),
          });
          throw new Error("rollback");
        }),
      ),
    ).rejects.toThrow("rollback");
    await expect(base.post.count()).resolves.toBe(0);
  });
});
