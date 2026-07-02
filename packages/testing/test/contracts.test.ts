import { describe, expect, it } from "vitest";

import { TenancyManager } from "@tenancyjs/core";

import {
  TenancyContractAssertionError,
  assertContract,
  createCoreTenancyContract,
  createIntegrationTenancyContract,
  createTenantFixture,
} from "../src/index.js";

describe("tenant fixtures", () => {
  it("creates deterministic independent shallow-frozen fixtures", () => {
    const first = createTenantFixture();
    const second = createTenantFixture({ id: "tenant-b", name: "Tenant B" });

    expect(first).toEqual({
      id: "tenant-a",
      name: "Tenant A",
      status: "active",
      strategy: "rowLevel",
    });
    expect(second.id).toBe("tenant-b");
    expect(first).not.toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
  });
});

describe("portable contracts", () => {
  it("runs the core contract without a test-runner dependency", async () => {
    for (const contractCase of createCoreTenancyContract()) {
      await expect(contractCase.run()).resolves.toBeUndefined();
      expect(Object.isFrozen(contractCase)).toBe(true);
    }
  });

  it("runs integration contracts against a correct bridge", async () => {
    const tenants = [
      createTenantFixture({ id: "tenant-a" }),
      createTenantFixture({ id: "tenant-b", name: "Tenant B" }),
    ] as const;
    const cases = createIntegrationTenancyContract(() => {
      const manager = new TenancyManager<(typeof tenants)[number]>();
      return {
        manager,
        execute: (tenant, callback) => manager.runWithTenant(tenant, callback),
      };
    }, tenants);

    for (const contractCase of cases) {
      await expect(contractCase.run()).resolves.toBeUndefined();
    }
  });

  it("detects an integration that fails to initialize tenant context", async () => {
    const tenants = [
      createTenantFixture({ id: "tenant-a" }),
      createTenantFixture({ id: "tenant-b" }),
    ] as const;
    const [firstCase] = createIntegrationTenancyContract(
      () => ({
        manager: new TenancyManager(),
        execute: async (_tenant, callback) => callback(),
      }),
      tenants,
    );

    await expect(firstCase!.run()).rejects.toBeInstanceOf(
      TenancyContractAssertionError,
    );
  });

  it("throws typed assertion errors with case context", () => {
    expect(() =>
      assertContract("example case", false, "expected value"),
    ).toThrow(
      expect.objectContaining({
        code: "TENANCY_CONTRACT_ASSERTION",
        caseName: "example case",
        message: "example case: expected value",
      }),
    );
  });
});
