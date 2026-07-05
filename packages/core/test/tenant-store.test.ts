import { describe, expect, it } from "vitest";

import {
  TenantStoreContractError,
  hardenTenantStore,
  requireStoreMethod,
  type TenantStore,
} from "../src/index.js";

interface Tenant {
  readonly id: string;
  readonly status?: "active" | "suspended";
}

describe("hardenTenantStore", () => {
  it("passes through valid results and preserves which methods exist", async () => {
    const store: TenantStore<Tenant> = {
      list: async () => [{ id: "a" }, { id: "b" }],
      find: async (id) => ({ id }),
      create: async (input) => ({ id: input.id ?? "generated" }),
      suspend: async (id) => ({ id, status: "suspended" }),
      activate: async (id) => ({ id, status: "active" }),
      delete: async () => undefined,
    };
    const hardened = hardenTenantStore(store);

    await expect(hardened.list!()).resolves.toEqual([{ id: "a" }, { id: "b" }]);
    await expect(hardened.find!("x")).resolves.toEqual({ id: "x" });
    await expect(hardened.create!({})).resolves.toEqual({ id: "generated" });
    await expect(hardened.suspend!("s")).resolves.toEqual({
      id: "s",
      status: "suspended",
    });
    await expect(hardened.delete!("d")).resolves.toBeUndefined();
  });

  it("omits methods the underlying store does not implement", () => {
    const hardened = hardenTenantStore<Tenant>({ list: async () => [] });
    expect(typeof hardened.list).toBe("function");
    expect(hardened.find).toBeUndefined();
    expect(hardened.create).toBeUndefined();
  });

  it("returns null from find without treating it as a mismatch", async () => {
    const hardened = hardenTenantStore<Tenant>({ find: async () => null });
    await expect(hardened.find!("missing")).resolves.toBeNull();
  });

  it("rejects a find() whose returned id does not match the request", async () => {
    const hardened = hardenTenantStore<Tenant>({
      find: async () => ({ id: "attacker" }),
    });
    await expect(hardened.find!("victim")).rejects.toMatchObject({
      code: "TENANCY_STORE_ID_MISMATCH",
      method: "find",
    });
  });

  it("rejects suspend()/activate() that return the wrong tenant", async () => {
    const hardened = hardenTenantStore<Tenant>({
      suspend: async () => ({ id: "other" }),
      activate: async () => ({ id: "other" }),
    });
    await expect(hardened.suspend!("t")).rejects.toBeInstanceOf(
      TenantStoreContractError,
    );
    await expect(hardened.activate!("t")).rejects.toBeInstanceOf(
      TenantStoreContractError,
    );
  });

  it("rejects create() that ignores an explicitly requested id", async () => {
    const hardened = hardenTenantStore<Tenant>({
      create: async () => ({ id: "server-chose-this" }),
    });
    await expect(hardened.create!({ id: "requested" })).rejects.toMatchObject({
      code: "TENANCY_STORE_ID_MISMATCH",
    });
    // But a generated id (no id requested) is accepted.
    await expect(hardened.create!({})).resolves.toEqual({
      id: "server-chose-this",
    });
  });

  it("rejects list() with duplicate ids", async () => {
    const hardened = hardenTenantStore<Tenant>({
      list: async () => [{ id: "dup" }, { id: "dup" }],
    });
    await expect(hardened.list!()).rejects.toMatchObject({
      code: "TENANCY_STORE_DUPLICATE_ID",
    });
  });

  it("rejects a non-tenant shape returned by any read", async () => {
    const hardened = hardenTenantStore<Tenant>({
      list: async () => [{ id: "" } as Tenant],
      find: async () => ({}) as Tenant,
    });
    await expect(hardened.list!()).rejects.toMatchObject({
      code: "TENANCY_STORE_INVALID_TENANT",
    });
    await expect(hardened.find!("x")).rejects.toMatchObject({
      code: "TENANCY_STORE_INVALID_TENANT",
    });
  });
});

describe("requireStoreMethod", () => {
  it("returns the store narrowed when the method exists", () => {
    const store: TenantStore<Tenant> = { list: async () => [] };
    const narrowed = requireStoreMethod(store, "list");
    expect(narrowed.list).toBe(store.list);
  });

  it("throws a clear unsupported error when the method is absent", () => {
    expect(() => requireStoreMethod<Tenant, "create">({}, "create")).toThrow(
      /does not implement/,
    );
    try {
      requireStoreMethod<Tenant, "create">({}, "create");
    } catch (error) {
      expect(error).toBeInstanceOf(TenantStoreContractError);
      expect((error as TenantStoreContractError).code).toBe(
        "TENANCY_STORE_METHOD_UNSUPPORTED",
      );
    }
  });
});
