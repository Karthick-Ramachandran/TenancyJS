import { TenancyManager } from "tenancyjs-core";
import type { Model, ModelStatic, Sequelize } from "sequelize";
import { describe, expect, it } from "vitest";

import {
  SEQUELIZE_ADAPTER_CAPABILITIES,
  SequelizeTenancyConfigurationError,
  defineSequelizeTenancyConfig,
} from "../src/index.js";

const model = class Post {} as unknown as ModelStatic<Model>;
const sequelize = {
  transaction: async () => undefined,
} as unknown as Sequelize;

describe("Sequelize tenancy configuration", () => {
  it("classifies without exposing a mutable map", () => {
    const config = defineSequelizeTenancyConfig({
      manager: new TenancyManager(),
      sequelize,
      tenantModels: [{ model, table: "app.posts" }],
    });
    expect(config.classify(model)?.kind).toBe("tenant");
    expect(Object.isFrozen(config)).toBe(true);
    expect(SEQUELIZE_ADAPTER_CAPABILITIES.rawQueries).toBe("rejected");
    expect(SEQUELIZE_ADAPTER_CAPABILITIES.schemaPerTenant).toBe("supported");
    expect(SEQUELIZE_ADAPTER_CAPABILITIES.databasePerTenant).toBe("supported");
  });

  it("rejects fixed-schema model metadata in schema-per-tenant mode", () => {
    const qualifiedModel = Object.assign(class Post {}, {
      getTableName: () => ({ tableName: "posts", schema: "public" }),
    }) as unknown as ModelStatic<Model>;
    expect(() =>
      defineSequelizeTenancyConfig({
        manager: new TenancyManager(),
        sequelize,
        strategy: "schemaPerTenant",
        schema: () => "tenant_a",
        tenantModels: [{ model: qualifiedModel, table: "posts" }],
      }),
    ).toThrow(SequelizeTenancyConfigurationError);
  });

  it.each([
    null,
    {},
    { manager: new TenancyManager(), sequelize: {}, tenantModels: [] },
    { manager: new TenancyManager(), sequelize, tenantModels: [] },
    { manager: new TenancyManager(), sequelize, tenantModels: [{}] },
    {
      manager: new TenancyManager(),
      sequelize,
      tenantModels: [{ model, table: "bad-name.posts" }],
    },
    {
      manager: new TenancyManager(),
      sequelize,
      tenantModels: [{ model, table: "posts" }],
      centralModels: [{}],
    },
    {
      manager: new TenancyManager(),
      sequelize,
      tenantModels: [{ model, table: "posts" }],
      centralModels: [{ model }],
    },
    {
      manager: new TenancyManager(),
      sequelize,
      strategy: "schemaPerTenant",
      tenantModels: [{ model, table: "posts" }],
    },
    {
      manager: new TenancyManager(),
      sequelize,
      strategy: "schemaPerTenant",
      schema: () => "tenant_a",
      tenantModels: [{ model, table: "public.posts" }],
    },
    {
      manager: new TenancyManager(),
      sequelize,
      strategy: "databasePerTenant",
      tenantModels: [{ model, table: "posts" }],
    },
  ])("rejects invalid or duplicate configuration", (input) => {
    expect(() => defineSequelizeTenancyConfig(input as never)).toThrow(
      SequelizeTenancyConfigurationError,
    );
  });
});
