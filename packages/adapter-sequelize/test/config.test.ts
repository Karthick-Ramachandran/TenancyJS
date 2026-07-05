import { TenancyManager } from "tenancyjs-core";
import type { Model, ModelStatic, Sequelize } from "sequelize";
import { describe, expect, it } from "vitest";

import {
  SEQUELIZE_ADAPTER_CAPABILITIES,
  SequelizeTenancyConfigurationError,
  createSequelizeTenancy,
  defineSequelizeTenancyConfig,
} from "../src/index.js";

const model = class Post {} as unknown as ModelStatic<Model>;
const sequelize = {
  transaction: async () => undefined,
} as unknown as Sequelize;

describe("Sequelize tenancy configuration", () => {
  it("rejects a tenant Sequelize instance from a different dialect", async () => {
    const manager = new TenancyManager();
    const postgres = {
      transaction: async () => undefined,
      getDialect: () => "postgres",
      close: async () => undefined,
    } as unknown as Sequelize;
    const mysql = {
      transaction: async () => undefined,
      getDialect: () => "mysql",
      close: async () => undefined,
    } as unknown as Sequelize;
    const tenancy = createSequelizeTenancy({
      manager,
      sequelize: postgres,
      strategy: "databasePerTenant",
      tenantModels: [{ model, table: "posts" }],
      connection: () => ({ key: "tenant-db", create: () => mysql }),
    });
    await tenancy.validate();
    await expect(
      manager.runWithTenant({ id: "tenant-a" }, () =>
        tenancy.run(async () => undefined),
      ),
    ).rejects.toBeInstanceOf(SequelizeTenancyConfigurationError);
    await tenancy.close();
  });

  it("requires an explicit matching MySQL dialect and rejects MySQL schema mode", () => {
    const mysql = {
      transaction: async () => undefined,
      getDialect: () => "mysql",
    } as unknown as Sequelize;
    expect(() =>
      defineSequelizeTenancyConfig({
        manager: new TenancyManager(),
        sequelize: mysql,
        tenantModels: [{ model, table: "posts" }],
      }),
    ).toThrow(SequelizeTenancyConfigurationError);
    expect(
      defineSequelizeTenancyConfig({
        manager: new TenancyManager(),
        sequelize: mysql,
        dialect: "mysql",
        tenantModels: [{ model, table: "posts" }],
      }).dialect,
    ).toBe("mysql");
    expect(() =>
      defineSequelizeTenancyConfig({
        manager: new TenancyManager(),
        sequelize: mysql,
        dialect: "mysql",
        strategy: "schemaPerTenant",
        schema: () => "tenant_a",
        tenantModels: [{ model, table: "posts" }],
      }),
    ).toThrow(SequelizeTenancyConfigurationError);
  });

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
