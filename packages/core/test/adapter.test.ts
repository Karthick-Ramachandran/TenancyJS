import { describe, expect, expectTypeOf, it } from "vitest";

import type {
  TenancyAdapter,
  TenancyAdapterCapabilities,
  TenancyAdapterValidationResult,
} from "../src/index.js";

describe("TenancyAdapter contract", () => {
  it("describes capabilities and validation without an ORM dependency", async () => {
    const capabilities = {
      rowLevel: "supported",
      databasePerTenant: "unsupported",
      centralModels: "supported",
      transactions: "supported",
      nestedReads: "rejected",
      nestedWrites: "rejected",
      rawQueries: "rejected",
    } as const satisfies TenancyAdapterCapabilities;
    const adapter: TenancyAdapter = {
      name: "example",
      strategy: "rowLevel",
      capabilities,
      validate: () => ({ valid: true, issues: [] }),
    };

    const result = await adapter.validate();

    expect(result).toEqual({ valid: true, issues: [] });
    expect(adapter.capabilities.rawQueries).toBe("rejected");
    expectTypeOf(result).toMatchTypeOf<TenancyAdapterValidationResult>();
  });
});
