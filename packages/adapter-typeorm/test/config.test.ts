import { TenancyManager } from "tenancyjs-core";
import type { DataSource, EntityTarget, ObjectLiteral } from "typeorm";
import { describe, expect, it } from "vitest";

import {
  TYPEORM_ADAPTER_CAPABILITIES,
  TypeOrmTenancyConfigurationError,
  createTypeOrmTenancy,
  defineTypeOrmTenancyConfig,
} from "../src/index.js";

const entity = class Post {} as EntityTarget<ObjectLiteral>;
const dataSource = {
  transaction: async () => undefined,
} as unknown as DataSource;

describe("TypeORM tenancy configuration", () => {
  it("rejects a tenant DataSource from a different dialect", async () => {
    const manager = new TenancyManager();
    const postgres = {
      transaction: async () => undefined,
      options: { type: "postgres" },
    } as unknown as DataSource;
    const mysql = {
      transaction: async () => undefined,
      options: { type: "mysql" },
      isInitialized: false,
    } as unknown as DataSource;
    const tenancy = createTypeOrmTenancy({
      manager,
      dataSource: postgres,
      strategy: "databasePerTenant",
      tenantEntities: [{ entity, table: "posts" }],
      connection: () => ({ key: "tenant-db", create: () => mysql }),
    });
    await tenancy.validate();
    await expect(
      manager.runWithTenant({ id: "tenant-a" }, () =>
        tenancy.run(async () => undefined),
      ),
    ).rejects.toBeInstanceOf(TypeOrmTenancyConfigurationError);
    await tenancy.close();
  });

  it("requires an explicit matching MySQL dialect and rejects MySQL schema mode", () => {
    const mysql = {
      transaction: async () => undefined,
      options: { type: "mysql" },
    } as unknown as DataSource;
    expect(() =>
      defineTypeOrmTenancyConfig({
        manager: new TenancyManager(),
        dataSource: mysql,
        tenantEntities: [{ entity, table: "posts" }],
      }),
    ).toThrow(TypeOrmTenancyConfigurationError);
    expect(
      defineTypeOrmTenancyConfig({
        manager: new TenancyManager(),
        dataSource: mysql,
        dialect: "mysql",
        tenantEntities: [{ entity, table: "posts" }],
      }).dialect,
    ).toBe("mysql");
    expect(() =>
      defineTypeOrmTenancyConfig({
        manager: new TenancyManager(),
        dataSource: mysql,
        dialect: "mysql",
        strategy: "schemaPerTenant",
        schema: () => "tenant_a",
        tenantEntities: [{ entity, table: "posts" }],
      }),
    ).toThrow(TypeOrmTenancyConfigurationError);
  });

  it("classifies without exposing a mutable map", () => {
    const config = defineTypeOrmTenancyConfig({
      manager: new TenancyManager(),
      dataSource,
      tenantEntities: [{ entity, table: "app.posts" }],
    });
    expect(config.classify(entity)?.kind).toBe("tenant");
    expect(Object.isFrozen(config)).toBe(true);
    expect(TYPEORM_ADAPTER_CAPABILITIES.rawQueries).toBe("rejected");
    expect(TYPEORM_ADAPTER_CAPABILITIES.schemaPerTenant).toBe("supported");
    expect(TYPEORM_ADAPTER_CAPABILITIES.databasePerTenant).toBe("supported");
  });

  it("rejects fixed-schema entity metadata in schema-per-tenant mode", () => {
    const qualified = {
      transaction: async () => undefined,
      getMetadata: () => ({ schema: "public", tablePath: "public.posts" }),
    } as unknown as DataSource;
    expect(() =>
      defineTypeOrmTenancyConfig({
        manager: new TenancyManager(),
        dataSource: qualified,
        strategy: "schemaPerTenant",
        schema: () => "tenant_a",
        tenantEntities: [{ entity, table: "posts" }],
      }),
    ).toThrow(TypeOrmTenancyConfigurationError);
  });

  it.each([
    null,
    {},
    { manager: new TenancyManager(), dataSource: {}, tenantEntities: [] },
    { manager: new TenancyManager(), dataSource, tenantEntities: [] },
    { manager: new TenancyManager(), dataSource, tenantEntities: [{}] },
    {
      manager: new TenancyManager(),
      dataSource,
      tenantEntities: [{ entity, table: "bad-name.posts" }],
    },
    {
      manager: new TenancyManager(),
      dataSource,
      tenantEntities: [{ entity, table: "posts" }],
      centralEntities: [{}],
    },
    {
      manager: new TenancyManager(),
      dataSource,
      tenantEntities: [{ entity, table: "posts" }],
      centralEntities: [{ entity }],
    },
    {
      manager: new TenancyManager(),
      dataSource,
      strategy: "schemaPerTenant",
      tenantEntities: [{ entity, table: "posts" }],
    },
    {
      manager: new TenancyManager(),
      dataSource,
      strategy: "schemaPerTenant",
      schema: () => "tenant_a",
      tenantEntities: [{ entity, table: "public.posts" }],
    },
    {
      manager: new TenancyManager(),
      dataSource,
      strategy: "databasePerTenant",
      tenantEntities: [{ entity, table: "posts" }],
    },
  ])("rejects invalid or duplicate configuration", (input) => {
    expect(() => defineTypeOrmTenancyConfig(input as never)).toThrow(
      TypeOrmTenancyConfigurationError,
    );
  });
});
