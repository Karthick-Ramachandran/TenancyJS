import { mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { pgSchema, pgTable, text } from "drizzle-orm/pg-core";
import { TenancyManager } from "tenancyjs-core";
import { describe, expect, it, vi } from "vitest";

import {
  DRIZZLE_ADAPTER_CAPABILITIES,
  DrizzlePolicyValidationError,
  DrizzleTableUnregisteredError,
  DrizzleTenantFieldConflictError,
  DrizzleTenancyConfigurationError,
  DrizzleUnsafeCriteriaError,
  createDrizzleTenancy,
  createMySqlDrizzleBinding,
  createPostgresDrizzleBinding,
  defineDrizzleTenancyConfig,
} from "../src/index.js";

const posts = mysqlTable("posts", {
  id: varchar({ length: 64 }).primaryKey(),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  title: varchar({ length: 255 }).notNull(),
});
const central = mysqlTable("tenants", {
  id: varchar({ length: 64 }).primaryKey(),
});
const unknown = mysqlTable("unknown", {
  id: varchar({ length: 64 }).primaryKey(),
});

function fakeDatabase(rows: readonly Record<string, unknown>[] = []) {
  const values = vi.fn(async () => undefined);
  interface FakeDatabase {
    execute(query: unknown): Promise<{ rows: never[] }>;
    transaction<T>(
      callback: (transaction: FakeDatabase) => Promise<T>,
    ): Promise<T>;
    select(fields?: Record<string, unknown>): {
      from(): { where: ReturnType<typeof vi.fn> };
    };
    insert(): { values: typeof values };
    update(): { set(): { where: ReturnType<typeof vi.fn> } };
    delete(): { where: ReturnType<typeof vi.fn> };
  }
  const database: FakeDatabase = {
    execute: vi.fn(async () => ({ rows: [] })),
    transaction: async <T>(
      callback: (transaction: typeof database) => Promise<T>,
    ) => callback(database),
    select: (fields?: Record<string, unknown>) => ({
      from: () => ({
        where: vi.fn(async () =>
          fields === undefined ? [...rows] : [{ value: rows.length }],
        ),
      }),
    }),
    insert: () => ({ values }),
    update: () => ({
      set: () => ({ where: vi.fn(async () => ({ affectedRows: 0 })) }),
    }),
    delete: () => ({ where: vi.fn(async () => [{ affectedRows: 0 }]) }),
  };
  return { database, values };
}

describe("Drizzle tenancy adapter", () => {
  it("normalizes exhaustive table classification and capabilities", () => {
    const { database } = fakeDatabase();
    const manager = new TenancyManager();
    const config = defineDrizzleTenancyConfig({
      manager,
      database: createMySqlDrizzleBinding(database),
      tenantTables: [{ table: posts }],
      centralTables: [{ table: central }],
    });
    expect(config.classify(posts)?.kind).toBe("tenant");
    expect(config.classify(central)?.kind).toBe("central");
    expect(config.classify(unknown)).toBeUndefined();
    expect(Object.isFrozen(config)).toBe(true);
    expect(DRIZZLE_ADAPTER_CAPABILITIES.rawQueries).toBe("rejected");
  });

  it("reports MySQL row enforcement honestly and fails before validation", async () => {
    const { database } = fakeDatabase();
    const manager = new TenancyManager();
    const tenancy = createDrizzleTenancy({
      manager,
      database: createMySqlDrizzleBinding(database),
      tenantTables: [{ table: posts }],
    });
    await expect(tenancy.run(async () => undefined)).rejects.toBeInstanceOf(
      DrizzlePolicyValidationError,
    );
    await expect(tenancy.validate()).resolves.toMatchObject({
      valid: true,
      issues: [{ severity: "warning" }],
    });
    await expect(tenancy.run(async () => undefined)).rejects.toMatchObject({
      code: "TENANCY_CONTEXT_UNAVAILABLE",
    });
  });

  it("injects ownership and rejects conflicts, unsafe values, and unknown tables", async () => {
    const { database, values } = fakeDatabase();
    const manager = new TenancyManager();
    const tenancy = createDrizzleTenancy({
      manager,
      database: createMySqlDrizzleBinding(database),
      tenantTables: [{ table: posts }],
    });
    await tenancy.validate();
    const run = <T>(callback: Parameters<typeof tenancy.run<T>>[0]) =>
      manager.runWithTenant({ id: "tenant-a" }, () => tenancy.run(callback));
    await run((client) =>
      client.table(posts).create({ id: "one", title: "A" }),
    );
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-a" }),
    );
    await expect(
      run((client) => client.table(posts).findMany({ tenantId: "tenant-b" })),
    ).rejects.toBeInstanceOf(DrizzleTenantFieldConflictError);
    await expect(
      run((client) => client.table(posts).create({ tenantId: "tenant-b" })),
    ).rejects.toBeInstanceOf(DrizzleTenantFieldConflictError);
    await expect(
      run((client) => client.table(posts).update({}, { tenantId: "tenant-b" })),
    ).rejects.toBeInstanceOf(DrizzleTenantFieldConflictError);
    await expect(
      run((client) => client.table(posts).findMany({ id: {} as never })),
    ).rejects.toBeInstanceOf(DrizzleUnsafeCriteriaError);
    await expect(
      run((client) => client.table(unknown).findMany()),
    ).rejects.toBeInstanceOf(DrizzleTableUnregisteredError);
    await expect(
      run((client) => client.table(posts).createMany([])),
    ).rejects.toBeInstanceOf(DrizzleUnsafeCriteriaError);
    await expect(
      run((client) => client.table(posts).create(null as never)),
    ).rejects.toBeInstanceOf(DrizzleUnsafeCriteriaError);
    await tenancy.close();
  });

  it("delegates the complete protected CRUD and count surface", async () => {
    const { database, values } = fakeDatabase([
      { id: "one", tenantId: "tenant-a", title: "A" },
    ]);
    const manager = new TenancyManager();
    const tenancy = createDrizzleTenancy({
      manager,
      database: createMySqlDrizzleBinding(database),
      tenantTables: [{ table: posts }],
      centralTables: [{ table: central }],
    });
    await tenancy.validate();
    await manager.runWithTenant({ id: "tenant-a" }, () =>
      tenancy.run(async (client) => {
        await expect(
          client.table(posts).findOne({ id: "one" }),
        ).resolves.toMatchObject({ id: "one" });
        await expect(client.table(posts).count()).resolves.toBe(1);
        await client.table(posts).createMany([
          { id: "two", title: "B" },
          { id: "three", title: "C" },
        ]);
        await expect(
          client.table(posts).update({ id: "one" }, { title: "A2" }),
        ).resolves.toBe(0);
        await expect(client.table(posts).delete({ id: "one" })).resolves.toBe(
          0,
        );
        await client.table(central).create({ id: "tenant-a" });
      }),
    );
    expect(values).toHaveBeenCalledTimes(2);
  });

  it("rejects cross-placement access and mismatched tenant binding dialects", async () => {
    const { database } = fakeDatabase();
    const manager = new TenancyManager();
    const tenancy = createDrizzleTenancy({
      manager,
      database: createMySqlDrizzleBinding(database),
      strategy: "databasePerTenant",
      tenantTables: [{ table: posts }],
      centralTables: [{ table: central }],
      connection: () => ({
        key: "tenant-a-db",
        create: () => createPostgresDrizzleBinding(database),
      }),
    });
    await tenancy.validate();
    await expect(
      manager.runWithTenant({ id: "tenant-a" }, () =>
        tenancy.run(async () => undefined),
      ),
    ).rejects.toMatchObject({ code: "TENANCY_RESOURCE_CACHE_CREATION" });
    await expect(
      manager.runInCentralContext(() =>
        tenancy.run((client) => client.table(posts).count()),
      ),
    ).rejects.toBeInstanceOf(DrizzleUnsafeCriteriaError);
    await tenancy.close();

    const missingClose = createDrizzleTenancy({
      manager,
      database: createMySqlDrizzleBinding(database),
      strategy: "databasePerTenant",
      tenantTables: [{ table: posts }],
      connection: () => ({
        key: "tenant-a-no-close",
        create: () => createMySqlDrizzleBinding(database),
      }),
    });
    await missingClose.validate();
    await expect(
      manager.runWithTenant({ id: "tenant-a" }, () =>
        missingClose.run(async () => undefined),
      ),
    ).rejects.toMatchObject({ code: "TENANCY_RESOURCE_CACHE_CREATION" });
    await missingClose.close();
  });

  it("sanitizes PostgreSQL validation failures and validates bindings", async () => {
    expect(() => createMySqlDrizzleBinding({})).toThrow(
      DrizzleTenancyConfigurationError,
    );
    const close = vi.fn();
    const { database } = fakeDatabase();
    const binding = createPostgresDrizzleBinding(database, { close });
    await binding.close();
    expect(close).toHaveBeenCalledOnce();
    await expect(
      binding.postgresExecutor!("select ?", []),
    ).rejects.toBeInstanceOf(DrizzleTenancyConfigurationError);
    expect(() => binding.metadata({})).toThrow(
      DrizzleTenancyConfigurationError,
    );

    const manager = new TenancyManager();
    const failing = fakeDatabase().database;
    failing.execute = vi.fn(async () => {
      throw new Error("secret database failure");
    });
    const table = pgTable("posts", {
      id: text(),
      tenantId: text("tenant_id"),
    });
    const tenancy = createDrizzleTenancy({
      manager,
      database: createPostgresDrizzleBinding(failing),
      tenantTables: [{ table }],
    });
    await expect(tenancy.validate()).resolves.toMatchObject({
      valid: false,
      issues: [{ code: "TENANCY_DRIZZLE_POLICY_INTROSPECTION_FAILED" }],
    });
  });

  it("rejects invalid dialect, schema, table, and placement configuration", () => {
    const { database } = fakeDatabase();
    const manager = new TenancyManager();
    const mysql = createMySqlDrizzleBinding(database);
    const postgres = createPostgresDrizzleBinding(database);
    const fixed = pgSchema("fixed").table("posts", {
      id: text(),
      tenantId: text("tenant_id"),
    });
    const unqualified = pgTable("posts", {
      id: text(),
      tenantId: text("tenant_id"),
    });
    const invalid = [
      null,
      {},
      { manager, database: mysql, tenantTables: [] },
      {
        manager,
        database: mysql,
        tenantTables: [{ table: posts }, { table: posts }],
      },
      {
        manager,
        database: mysql,
        strategy: "unknown",
        tenantTables: [{ table: posts }],
      },
      {
        manager,
        database: mysql,
        strategy: "schemaPerTenant",
        schema: () => "tenant_a",
        tenantTables: [{ table: posts }],
      },
      {
        manager,
        database: postgres,
        strategy: "schemaPerTenant",
        schema: () => "tenant_a",
        tenantTables: [{ table: fixed }],
      },
      {
        manager,
        database: postgres,
        strategy: "schemaPerTenant",
        tenantTables: [{ table: unqualified }],
      },
      {
        manager,
        database: mysql,
        strategy: "databasePerTenant",
        tenantTables: [{ table: posts }],
      },
      {
        manager,
        database: mysql,
        tenantTables: [{ table: posts }],
        schema: () => "bad",
      },
      {
        manager,
        database: mysql,
        tenantTables: [{ table: posts }],
        centralSchema: "bad",
      },
      {
        manager,
        database: mysql,
        tenantTables: [{ table: posts }],
        role: () => "bad",
      },
      {
        manager,
        database: mysql,
        tenantTables: [{ table: posts }],
        connection: () => ({}),
      },
      {
        manager,
        database: mysql,
        tenantTables: [{ table: posts }],
        maxConnections: 0,
      },
      {
        manager,
        database: mysql,
        strategy: "databasePerTenant",
        connection: () => ({ key: "x", create: () => mysql }),
        maxConnections: 0,
        tenantTables: [{ table: posts }],
      },
      {
        manager,
        database: mysql,
        tenantTables: [{ table: posts }],
        centralTables: {},
      },
      {
        manager,
        database: mysql,
        tenantTables: [{ table: posts }],
        centralTables: [{}],
      },
      {
        manager,
        database: mysql,
        tenantTables: [{ table: posts, tenantColumn: "wrong" }],
      },
      {
        manager,
        database: mysql,
        tenantTables: [{ table: posts, tenantProperty: "bad-name" }],
      },
    ];
    for (const input of invalid)
      expect(() => defineDrizzleTenancyConfig(input as never)).toThrow(
        DrizzleTenancyConfigurationError,
      );
  });
});
