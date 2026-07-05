import { TenancyManager } from "tenancyjs-core";
import { describe, expect, expectTypeOf, it } from "vitest";

import type { PrismaClient } from "../../../.artifacts/prisma/adapter-prisma/client.js";
import { createPrismaTenancyExtension } from "../src/index.js";

const extension = createPrismaTenancyExtension({
  manager: new TenancyManager(),
  tenantModels: {
    Post: { relationFields: ["comments"] },
    Comment: { relationFields: ["post"] },
  },
  centralModels: { Tenant: {} },
});

function extendGeneratedClient(client: PrismaClient) {
  return client.$extends(extension);
}

describe("generated Prisma Client compatibility", () => {
  it("accepts the TenancyJS extension without erasing generated model types", () => {
    expect(extendGeneratedClient).toBeTypeOf("function");
    expectTypeOf(extendGeneratedClient).returns.toHaveProperty("post");
    expectTypeOf(extendGeneratedClient).returns.toHaveProperty("comment");
    expectTypeOf(extendGeneratedClient).returns.toHaveProperty("tenant");
  });
});
