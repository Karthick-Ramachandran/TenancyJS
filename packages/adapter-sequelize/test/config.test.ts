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
  ])("rejects invalid or duplicate configuration", (input) => {
    expect(() => defineSequelizeTenancyConfig(input as never)).toThrow(
      SequelizeTenancyConfigurationError,
    );
  });
});
