import { TenancyManager } from "tenancyjs-core";
import type { DataSource, EntityTarget, ObjectLiteral } from "typeorm";
import { describe, expect, it } from "vitest";

import {
  TYPEORM_ADAPTER_CAPABILITIES,
  TypeOrmTenancyConfigurationError,
  defineTypeOrmTenancyConfig,
} from "../src/index.js";

const entity = class Post {} as EntityTarget<ObjectLiteral>;
const dataSource = {
  transaction: async () => undefined,
} as unknown as DataSource;

describe("TypeORM tenancy configuration", () => {
  it("classifies without exposing a mutable map", () => {
    const config = defineTypeOrmTenancyConfig({
      manager: new TenancyManager(),
      dataSource,
      tenantEntities: [{ entity, table: "app.posts" }],
    });
    expect(config.classify(entity)?.kind).toBe("tenant");
    expect(Object.isFrozen(config)).toBe(true);
    expect(TYPEORM_ADAPTER_CAPABILITIES.rawQueries).toBe("rejected");
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
  ])("rejects invalid or duplicate configuration", (input) => {
    expect(() => defineTypeOrmTenancyConfig(input as never)).toThrow(
      TypeOrmTenancyConfigurationError,
    );
  });
});
