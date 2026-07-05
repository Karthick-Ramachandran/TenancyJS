import { TenancyManager, TenantContextError } from "@tenancyjs/core";
import type { ClientSession, Connection, Model } from "mongoose";
import { describe, expect, it, vi } from "vitest";

import {
  MongooseModelUnregisteredError,
  MongooseTenantFieldConflictError,
  MongooseUnsafeFilterError,
  MongooseValidationError,
  createMongooseTenancy,
} from "../src/index.js";

interface Tenant {
  readonly id: string;
}

function harness() {
  const calls: Array<readonly [string, unknown]> = [];
  const session = {} as ClientSession;
  const query = (result: unknown) => ({
    session(received: ClientSession) {
      calls.push(["session", received]);
      return this;
    },
    lean() {
      return this;
    },
    async exec() {
      return result;
    },
  });
  const model = Object.assign(function FakeModel() {}, {
    find: vi.fn((filter) => {
      calls.push(["find", filter]);
      return query([{ id: "same-id", tenantId: "tenant-a" }]);
    }),
    findOne: vi.fn((filter) => query({ ...filter, title: "A" })),
    countDocuments: vi.fn((filter) => query(Object.keys(filter).length)),
    insertMany: vi.fn(async (values, options) => {
      calls.push(["insertMany", { values, options }]);
      return values;
    }),
    updateMany: vi.fn(async (filter, update, options) => {
      calls.push(["updateMany", { filter, update, options }]);
      return { modifiedCount: 1 };
    }),
    deleteMany: vi.fn(async (filter, options) => {
      calls.push(["deleteMany", { filter, options }]);
      return { deletedCount: 1 };
    }),
  }) as unknown as Model<unknown>;
  const connection = {
    db: { admin: () => ({ command: async () => ({ setName: "rs0" }) }) },
    transaction: vi.fn(
      async (callback: (session: ClientSession) => Promise<unknown>) =>
        callback(session),
    ),
  } as unknown as Connection;
  const manager = new TenancyManager<Tenant>();
  const adapter = createMongooseTenancy({
    manager,
    connection,
    tenantModels: [{ model }],
  });
  return { adapter, calls, connection, manager, model, session };
}

describe("Mongoose tenancy adapter", () => {
  it("rejects a standalone topology during validation", async () => {
    const fixture = harness();
    Object.defineProperty(fixture.connection, "db", {
      value: { admin: () => ({ command: async () => ({}) }) },
    });
    const result = await fixture.adapter.validate();
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.code).toBe(
      "TENANCY_MONGOOSE_REPLICA_SET_REQUIRED",
    );
  });
  it("reports the adapter-enforced tier and injects filters/data/session", async () => {
    const { adapter, calls, manager, model, session } = harness();
    await expect(adapter.validate()).resolves.toEqual({
      valid: true,
      issues: [
        {
          code: "TENANCY_MONGOOSE_ADAPTER_ENFORCED",
          severity: "warning",
          message: expect.stringContaining("adapter-enforced"),
        },
      ],
    });
    const rows = await manager.runWithTenant({ id: "tenant-a" }, () =>
      adapter.run(async (client) => {
        const protectedModel = client.model(model);
        await protectedModel.create({ id: "same-id", title: "A" });
        await protectedModel.update({ id: "same-id" }, { title: "A2" });
        return protectedModel.find({ id: "same-id" });
      }),
    );
    expect(rows).toEqual([{ id: "same-id", tenantId: "tenant-a" }]);
    expect(Object.isFrozen(rows[0])).toBe(true);
    expect(calls).toContainEqual([
      "find",
      { id: "same-id", tenantId: "tenant-a" },
    ]);
    expect(calls).toContainEqual(["session", session]);
    expect(calls.find(([name]) => name === "insertMany")?.[1]).toMatchObject({
      values: [{ id: "same-id", title: "A", tenantId: "tenant-a" }],
      options: { session },
    });
  });

  it("fails closed before unsafe delegation", async () => {
    const { adapter, manager, model } = harness();
    await expect(
      manager.runWithTenant({ id: "tenant-a" }, () =>
        adapter.run(async () => undefined),
      ),
    ).rejects.toBeInstanceOf(MongooseValidationError);
    await adapter.validate();
    await expect(adapter.run(async () => undefined)).rejects.toBeInstanceOf(
      TenantContextError,
    );
    await expect(
      manager.runWithTenant({ id: "tenant-a" }, () =>
        adapter.run((client) =>
          client.model(model).create({ tenantId: "tenant-b" }),
        ),
      ),
    ).rejects.toBeInstanceOf(MongooseTenantFieldConflictError);
    await expect(
      manager.runWithTenant({ id: "tenant-a" }, () =>
        adapter.run((client) =>
          client.model(model).find({ $where: "secret" } as never),
        ),
      ),
    ).rejects.toBeInstanceOf(MongooseUnsafeFilterError);
    await expect(
      manager.runWithTenant({ id: "tenant-a" }, () =>
        adapter.run((client) => client.model(function Unknown() {} as never)),
      ),
    ).rejects.toBeInstanceOf(MongooseModelUnregisteredError);
  });
});
