import { TenantContextError, TenancyManager } from "@tenancyjs/core";
import { describe, expect, it, vi } from "vitest";

import {
  PrismaTenantFieldConflictError,
  PrismaUnsupportedOperationError,
  PrismaUnregisteredModelError,
  applyPrismaTenantPolicy,
  createPrismaAdapter,
  createPrismaTenancyExtension,
  definePrismaTenancyConfig,
} from "../src/index.js";

const manager = new TenancyManager();
const config = definePrismaTenancyConfig({
  manager,
  tenantModels: {
    Post: { relationFields: ["comments", "author"] },
  },
  centralModels: { Tenant: { relationFields: ["posts"] } },
});

describe("Prisma tenant operation policy", () => {
  it.each([
    "findUnique",
    "findUniqueOrThrow",
    "findFirst",
    "findFirstOrThrow",
    "findMany",
    "count",
    "aggregate",
    "groupBy",
    "delete",
    "deleteMany",
  ])(
    "scopes %s through an AND predicate without mutating input",
    async (operation) => {
      const args = { where: { published: true } };

      const scoped = await manager.runWithTenant({ id: "tenant-a" }, () =>
        applyPrismaTenantPolicy(config, "Post", operation, args),
      );

      expect(scoped).toEqual({
        where: { published: true, AND: [{ tenantId: "tenant-a" }] },
      });
      expect(args).toEqual({ where: { published: true } });
    },
  );

  it("adds a tenant predicate when a read has no where input", async () => {
    await expect(
      manager.runWithTenant({ id: "tenant-a" }, () =>
        applyPrismaTenantPolicy(config, "Post", "findMany", {}),
      ),
    ).resolves.toEqual({ where: { tenantId: "tenant-a" } });
  });

  it.each(["create", "createMany", "createManyAndReturn"])(
    "injects tenant identity for %s",
    async (operation) => {
      const data =
        operation === "create"
          ? { title: "one" }
          : [{ title: "one" }, { title: "two", tenantId: "tenant-a" }];

      const scoped = await manager.runWithTenant({ id: "tenant-a" }, () =>
        applyPrismaTenantPolicy(config, "Post", operation, { data }),
      );

      expect(scoped).toEqual({
        data: Array.isArray(data)
          ? [
              { title: "one", tenantId: "tenant-a" },
              { title: "two", tenantId: "tenant-a" },
            ]
          : { title: "one", tenantId: "tenant-a" },
      });
      expect(data).not.toHaveProperty("tenantId");
    },
  );

  it("rejects a conflicting create tenant", async () => {
    await expect(
      manager.runWithTenant({ id: "tenant-a" }, () =>
        applyPrismaTenantPolicy(config, "Post", "create", {
          data: { title: "secret", tenantId: "tenant-b" },
        }),
      ),
    ).rejects.toBeInstanceOf(PrismaTenantFieldConflictError);
  });

  it.each(["update", "updateMany", "updateManyAndReturn"])(
    "scopes %s and preserves safe update data",
    async (operation) => {
      await expect(
        manager.runWithTenant({ id: "tenant-a" }, () =>
          applyPrismaTenantPolicy(config, "Post", operation, {
            where: { published: false },
            data: { published: true },
          }),
        ),
      ).resolves.toEqual({
        where: {
          published: false,
          AND: [{ tenantId: "tenant-a" }],
        },
        data: { published: true },
      });
    },
  );

  it("rejects every attempt to update the tenant discriminator", async () => {
    await expect(
      manager.runWithTenant({ id: "tenant-a" }, () =>
        applyPrismaTenantPolicy(config, "Post", "update", {
          where: { id: 1 },
          data: { tenantId: "tenant-a" },
        }),
      ),
    ).rejects.toBeInstanceOf(PrismaTenantFieldConflictError);
  });

  it("scopes both upsert branches", async () => {
    await expect(
      manager.runWithTenant({ id: "tenant-a" }, () =>
        applyPrismaTenantPolicy(config, "Post", "upsert", {
          where: { id: 1 },
          create: { title: "created" },
          update: { title: "updated" },
        }),
      ),
    ).resolves.toEqual({
      where: { id: 1, AND: [{ tenantId: "tenant-a" }] },
      create: { title: "created", tenantId: "tenant-a" },
      update: { title: "updated" },
    });
  });

  it("requires tenant context for tenant-scoped models", () => {
    expect(() =>
      applyPrismaTenantPolicy(config, "Post", "findMany", {}),
    ).toThrow(TenantContextError);
  });

  it("allows explicit central context to bypass tenant predicates", async () => {
    const args = { where: { id: 1 } };

    await expect(
      manager.runInCentralContext(() =>
        applyPrismaTenantPolicy(config, "Post", "findUnique", args),
      ),
    ).resolves.toBe(args);
  });

  it("passes allowlisted central models without tenancy context", () => {
    const args = { where: { id: "tenant-a" } };
    expect(applyPrismaTenantPolicy(config, "Tenant", "findUnique", args)).toBe(
      args,
    );
  });

  it("rejects unknown and nested central-model operations", () => {
    expect(() =>
      applyPrismaTenantPolicy(config, "Tenant", "findRaw", {}),
    ).toThrow(PrismaUnsupportedOperationError);
    expect(() =>
      applyPrismaTenantPolicy(config, "Tenant", "findMany", {
        include: { posts: true },
      }),
    ).toThrow(PrismaUnsupportedOperationError);
  });

  it("rejects nested operations even in explicit central context", async () => {
    await expect(
      manager.runInCentralContext(() =>
        applyPrismaTenantPolicy(config, "Post", "findMany", {
          include: { comments: true },
        }),
      ),
    ).rejects.toBeInstanceOf(PrismaUnsupportedOperationError);
  });

  it("fails closed for raw, unknown model, unknown operation, and nested relations", async () => {
    expect(() =>
      applyPrismaTenantPolicy(config, undefined, "$queryRaw", []),
    ).toThrow(
      expect.objectContaining({
        code: "TENANCY_PRISMA_UNSUPPORTED_OPERATION",
        reason: "raw",
      }),
    );
    expect(() =>
      applyPrismaTenantPolicy(config, "User", "findMany", {}),
    ).toThrow(PrismaUnregisteredModelError);

    await expect(
      manager.runWithTenant({ id: "tenant-a" }, () =>
        applyPrismaTenantPolicy(config, "Post", "findRaw", {}),
      ),
    ).rejects.toMatchObject({
      code: "TENANCY_PRISMA_UNSUPPORTED_OPERATION",
      reason: "operation",
    });
    await expect(
      manager.runWithTenant({ id: "tenant-a" }, () =>
        applyPrismaTenantPolicy(config, "Post", "findMany", {
          include: { comments: true },
        }),
      ),
    ).rejects.toMatchObject({
      code: "TENANCY_PRISMA_UNSUPPORTED_OPERATION",
      reason: "relation",
    });
    await expect(
      manager.runWithTenant({ id: "tenant-a" }, () =>
        applyPrismaTenantPolicy(config, "Post", "findMany", {
          where: { AND: [{ author: { is: { active: true } } }] },
        }),
      ),
    ).rejects.toBeInstanceOf(PrismaUnsupportedOperationError);
  });
});

describe("Prisma tenancy extension", () => {
  it("delegates exactly once with scoped arguments and preserves results", async () => {
    const extension = createPrismaTenancyExtension({
      manager,
      tenantModels: { Post: {} },
    });
    const query = vi.fn().mockResolvedValue([{ id: 1 }]);

    const result = await manager.runWithTenant({ id: "tenant-a" }, () =>
      extension.query.$allOperations({
        model: "Post",
        operation: "findMany",
        args: { where: { published: true } },
        query,
      }),
    );

    expect(result).toEqual([{ id: 1 }]);
    expect(query).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith({
      where: {
        published: true,
        AND: [{ tenantId: "tenant-a" }],
      },
    });
  });

  it("does not delegate rejected operations or hide delegated errors", async () => {
    const extension = createPrismaTenancyExtension({
      manager,
      tenantModels: { Post: {} },
    });
    const rejectedQuery = vi.fn();

    await expect(
      extension.query.$allOperations({
        operation: "$executeRawUnsafe",
        args: ["delete from Post"],
        query: rejectedQuery,
      }),
    ).rejects.toBeInstanceOf(PrismaUnsupportedOperationError);
    expect(rejectedQuery).not.toHaveBeenCalled();

    const failure = new Error("database unavailable");
    const failingQuery = vi.fn().mockRejectedValue(failure);
    await expect(
      manager.runWithTenant({ id: "tenant-a" }, () =>
        extension.query.$allOperations({
          model: "Post",
          operation: "findMany",
          args: {},
          query: failingQuery,
        }),
      ),
    ).rejects.toBe(failure);
  });

  it("creates a validated adapter descriptor", async () => {
    const adapter = createPrismaAdapter({
      manager,
      tenantModels: { Post: {} },
    });

    expect(adapter.name).toBe("prisma");
    expect(adapter.strategy).toBe("rowLevel");
    expect(adapter.extension.name).toBe("tenancyjs-row-level");
    expect(await adapter.validate()).toEqual({
      valid: true,
      issues: [
        {
          code: "TENANCY_PRISMA_SCHEMA_CLASSIFICATION_UNVERIFIED",
          severity: "warning",
          message: expect.stringContaining("generated Prisma schema"),
        },
      ],
    });
    expect(Object.isFrozen(adapter)).toBe(true);
  });
});
