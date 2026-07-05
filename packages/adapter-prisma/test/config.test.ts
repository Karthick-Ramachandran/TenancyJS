import { TenancyManager } from "tenancyjs-core";
import { describe, expect, it } from "vitest";

import {
  PRISMA_ADAPTER_CAPABILITIES,
  PrismaTenancyConfigurationError,
  PrismaUnregisteredModelError,
  classifyPrismaModel,
  definePrismaTenancyConfig,
} from "../src/index.js";

describe("Prisma tenancy configuration", () => {
  const manager = new TenancyManager();

  it("normalizes and freezes explicit model classifications", () => {
    const config = definePrismaTenancyConfig({
      manager,
      tenantModels: {
        Post: { relationFields: ["comments"] },
        Invoice: { tenantField: "accountId" },
      },
      centralModels: { Tenant: { relationFields: ["posts"] } },
    });

    expect(config.tenantModels).toEqual({
      Post: { tenantField: "tenantId", relationFields: ["comments"] },
      Invoice: { tenantField: "accountId", relationFields: [] },
    });
    expect(classifyPrismaModel(config, "Post")).toEqual({
      kind: "tenant",
      model: "Post",
      tenantField: "tenantId",
      relationFields: ["comments"],
    });
    expect(classifyPrismaModel(config, "Tenant")).toEqual({
      kind: "central",
      model: "Tenant",
      relationFields: ["posts"],
    });
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.tenantModels)).toBe(true);
    expect(Object.isFrozen(config.tenantModels.Post)).toBe(true);
    expect(Object.isFrozen(config.tenantModels.Post?.relationFields)).toBe(
      true,
    );
  });

  it.each([
    {
      name: "empty tenant model map",
      options: { manager, tenantModels: {} },
    },
    {
      name: "invalid model name",
      options: { manager, tenantModels: { "bad model": {} } },
    },
    {
      name: "invalid tenant field",
      options: {
        manager,
        tenantModels: { Post: { tenantField: "tenant-id" } },
      },
    },
    {
      name: "repeated relation field",
      options: {
        manager,
        tenantModels: {
          Post: { relationFields: ["comments", "comments"] },
        },
      },
    },
    {
      name: "tenant field used as relation",
      options: {
        manager,
        tenantModels: { Post: { relationFields: ["tenantId"] } },
      },
    },
    {
      name: "invalid central model configuration",
      options: {
        manager,
        tenantModels: { Post: {} },
        centralModels: { Tenant: null },
      },
    },
    {
      name: "overlapping model classification",
      options: {
        manager,
        tenantModels: { Post: {} },
        centralModels: { Post: {} },
      },
    },
  ])("rejects $name", ({ options }) => {
    expect(() => definePrismaTenancyConfig(options as never)).toThrow(
      PrismaTenancyConfigurationError,
    );
  });

  it("fails closed for an unregistered model without exposing query data", () => {
    const config = definePrismaTenancyConfig({
      manager,
      tenantModels: { Post: {} },
    });

    expect(() => classifyPrismaModel(config, "Secret")).toThrow(
      PrismaUnregisteredModelError,
    );
    expect(() => classifyPrismaModel(config, "Secret")).toThrow(
      "Add it to tenantModels or centralModels during startup configuration",
    );
  });

  it("publishes an immutable, fail-closed capability contract", () => {
    expect(PRISMA_ADAPTER_CAPABILITIES).toEqual({
      rowLevel: "supported",
      schemaPerTenant: "unsupported",
      databasePerTenant: "supported",
      centralModels: "supported",
      transactions: "supported",
      nestedReads: "rejected",
      nestedWrites: "rejected",
      rawQueries: "rejected",
    });
    expect(Object.isFrozen(PRISMA_ADAPTER_CAPABILITIES)).toBe(true);
  });
});
