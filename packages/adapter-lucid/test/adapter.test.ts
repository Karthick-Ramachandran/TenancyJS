import { describe, expect, it, vi } from "vitest";
import { TenancyManager } from "tenancyjs-core";
import type { Database } from "@adonisjs/lucid/database";
import type { TransactionClientContract } from "@adonisjs/lucid/types/database";
import type { LucidModel, LucidRow } from "@adonisjs/lucid/types/model";

import {
  LUCID_ADAPTER_CAPABILITIES,
  LucidPolicyValidationError,
  LucidScopeError,
  LucidTenantFieldConflictError,
  LucidTenancyConfigurationError,
  createLucidTenancy,
  defineLucidTenancyConfig,
} from "../src/index.js";

type Hook = (value: unknown) => void | Promise<void>;

interface Tenant {
  readonly id: string;
  readonly name: string;
}

interface FakeModelHarness {
  readonly model: LucidModel;
  hook(event: string): Hook;
}

interface FakeDatabaseHarness {
  database: Database;
  readonly transactionCalls: ReturnType<typeof vi.fn>;
  readonly transactionRawQuery: ReturnType<typeof vi.fn>;
  readonly savepointCalls: ReturnType<typeof vi.fn>;
  failValidation: boolean;
  roleRows: readonly Record<string, unknown>[];
  policyRows: readonly Record<string, unknown>[];
}

describe("createLucidTenancy", () => {
  it("defines a frozen AdonisJS 7/Lucid 22 capability boundary", () => {
    expect(LUCID_ADAPTER_CAPABILITIES).toEqual({
      rowLevel: "supported",
      schemaPerTenant: "supported",
      databasePerTenant: "supported",
      centralModels: "supported",
      transactions: "supported",
      nestedReads: "supported",
      nestedWrites: "rejected",
      rawQueries: "rejected",
    });
    expect(Object.isFrozen(LUCID_ADAPTER_CAPABILITIES)).toBe(true);
  });

  it("normalizes model metadata and rejects unsafe or duplicate configuration", () => {
    const manager = new TenancyManager();
    const database = createFakeDatabase().database;
    const first = createFakeModel("Post", "posts").model;
    const second = createFakeModel("Comment", "comments").model;
    const config = defineLucidTenancyConfig({
      manager,
      database,
      tenantModels: [
        { model: first },
        { model: second, table: "app.comments" },
      ],
    });

    expect(config.tenantModels).toMatchObject([
      {
        modelName: "Post",
        qualifiedName: "public.posts",
        tenantAttribute: "tenantId",
        tenantColumn: "tenant_id",
        policyName: "posts_tenant_isolation",
      },
      { modelName: "Comment", qualifiedName: "app.comments" },
    ]);
    expect(Object.isFrozen(config.tenantModels)).toBe(true);

    expect(() =>
      defineLucidTenancyConfig({
        manager,
        database,
        tenantModels: [{ model: first }, { model: first }],
      }),
    ).toThrow(LucidTenancyConfigurationError);
    expect(() =>
      defineLucidTenancyConfig({
        manager,
        database,
        tenantModels: [{ model: first, tenantColumn: "tenant-id" }],
      }),
    ).toThrow("valid identifier");
    expect(() =>
      defineLucidTenancyConfig({
        manager,
        database,
        tenantModels: [{ model: first, table: "posts as p" }],
      }),
    ).toThrow("unaliased PostgreSQL identifier");
    expect(() =>
      defineLucidTenancyConfig({
        manager,
        database,
        tenantModels: [{ model: first }, { model: second, table: "posts" }],
      }),
    ).toThrow("configured more than once");
    for (const invalid of [
      null,
      {},
      { manager, database: {}, tenantModels: [{ model: first }] },
      { manager, database, tenantModels: [] },
      { manager, database, tenantModels: [null] },
      { manager, database, tenantModels: [{ model: {} }] },
      { manager, database, tenantModels: [{ model: first, table: 1 }] },
      {
        manager,
        database,
        tenantModels: [{ model: first, policyName: "bad-name" }],
      },
      {
        manager,
        database,
        tenantModels: [{ model: first, tenantAttribute: "bad-name" }],
      },
    ]) {
      expect(() =>
        defineLucidTenancyConfig(
          invalid as unknown as Parameters<typeof defineLucidTenancyConfig>[0],
        ),
      ).toThrow(LucidTenancyConfigurationError);
    }
  });

  it("normalizes schema-per-tenant models as unqualified placement names", () => {
    const manager = new TenancyManager<Tenant>();
    const database = createFakeDatabase().database;
    const model = createFakeModel("Post", "posts").model;
    const config = defineLucidTenancyConfig({
      manager,
      database,
      strategy: "schemaPerTenant",
      schema: (tenant) => `tenant_${tenant.id}`,
      centralSchema: "central",
      tenantModels: [{ model }],
    });

    expect(config.strategy).toBe("schemaPerTenant");
    expect(config.tenantModels[0]).toMatchObject({
      schema: undefined,
      table: "posts",
      qualifiedName: "posts",
    });
    expect(config.schema?.({ id: "a", name: "A" })).toBe("tenant_a");
  });

  it.each([
    ["missing schema resolver", { strategy: "schemaPerTenant" }],
    [
      "qualified model table",
      {
        strategy: "schemaPerTenant",
        schema: (): string => "tenant_a",
        table: "app.posts",
      },
    ],
    [
      "row-level schema resolver",
      { strategy: "rowLevel", schema: (): string => "tenant_a" },
    ],
    [
      "row-level central placement",
      { strategy: "rowLevel", centralSchema: "central" },
    ],
    [
      "schema-mode row policy",
      {
        strategy: "schemaPerTenant",
        schema: (): string => "tenant_a",
        tenantColumn: "tenant_id",
      },
    ],
    [
      "invalid central schema",
      {
        strategy: "schemaPerTenant",
        schema: (): string => "tenant_a",
        centralSchema: "central-schema",
      },
    ],
    ["unknown strategy", { strategy: "unknown" }],
    [
      "database-per-tenant without connection",
      { strategy: "databasePerTenant" },
    ],
    [
      "connection on row-level",
      { connection: () => ({ key: "k", create: () => ({}) }) },
    ],
    ["maxConnections on row-level", { maxConnections: 5 }],
    [
      "non-positive maxConnections",
      {
        strategy: "databasePerTenant",
        connection: () => ({ key: "k", create: () => ({}) }),
        maxConnections: 0,
      },
    ],
    [
      "database-per-tenant row policy",
      {
        strategy: "databasePerTenant",
        connection: () => ({ key: "k", create: () => ({}) }),
        tenantColumn: "tenant_id",
      },
    ],
  ])("rejects schema strategy configuration with %s", (_name, input) => {
    const model = createFakeModel("Post", "posts").model;
    expect(() =>
      defineLucidTenancyConfig({
        manager: new TenancyManager(),
        database: createFakeDatabase().database,
        tenantModels: [
          {
            model,
            ...("table" in input ? { table: input.table } : {}),
            ...("tenantColumn" in input
              ? { tenantColumn: input.tenantColumn }
              : {}),
          },
        ],
        ...input,
      } as never),
    ).toThrow(LucidTenancyConfigurationError);
  });

  it("validates forced RLS before entering a transaction", async () => {
    const manager = new TenancyManager();
    const model = createFakeModel("Post", "posts");
    const database = createFakeDatabase();
    const adapter = createLucidTenancy({
      manager,
      database: database.database,
      tenantModels: [{ model: model.model }],
    });

    await expect(
      manager.runWithTenant({ id: "tenant-a" }, () => adapter.run(() => 1)),
    ).rejects.toBeInstanceOf(LucidPolicyValidationError);
    await expect(adapter.validate()).resolves.toEqual({
      valid: true,
      issues: [],
    });
    await expect(
      manager.runWithTenant({ id: "tenant-a" }, () => adapter.run(() => 1)),
    ).resolves.toBe(1);
    expect(database.transactionCalls).toHaveBeenCalledTimes(1);
    expect(database.transactionRawQuery).toHaveBeenCalledWith(
      "select set_config(?, ?, true), set_config(?, ?, true)",
      ["tenancyjs.tenant_id", "tenant-a", "tenancyjs.is_central", "false"],
    );
  });

  it("reports tenant database validation as deferred", async () => {
    const manager = new TenancyManager<Tenant>();
    const model = createFakeModel("Post", "posts");
    const database = createFakeDatabase();
    const adapter = createLucidTenancy({
      manager,
      database: database.database,
      strategy: "databasePerTenant",
      connection: () => ({
        key: "tenant-db",
        create: () => ({
          transaction: database.database.transaction.bind(database.database),
          destroy: () => undefined,
        }),
      }),
      tenantModels: [{ model: model.model }],
    });

    await expect(adapter.validate()).resolves.toEqual({
      valid: true,
      issues: [
        {
          code: "TENANCY_LUCID_TENANT_DATABASE_VALIDATION_DEFERRED",
          severity: "warning",
          message: expect.stringContaining("first used"),
        },
      ],
    });
  });

  it("fails closed on cross-tenant and central-in-tenant run() nesting", async () => {
    const manager = new TenancyManager();
    const model = createFakeModel("Post", "posts");
    const database = createFakeDatabase();
    const adapter = createLucidTenancy({
      manager,
      database: database.database,
      tenantModels: [{ model: model.model }],
    });
    await adapter.validate();

    // Same-tenant nesting is allowed (a savepoint on the same scope).
    await expect(
      manager.runWithTenant({ id: "a" }, () =>
        adapter.run(() =>
          manager.runWithTenant({ id: "a" }, () => adapter.run(() => 1)),
        ),
      ),
    ).resolves.toBe(1);

    // A different tenant nested inside tenant A must fail closed — reusing A's
    // transaction for tenant B would route B's work to A's schema/connection.
    await expect(
      manager.runWithTenant({ id: "a" }, () =>
        adapter.run(() =>
          manager.runWithTenant({ id: "b" }, () => adapter.run(() => 1)),
        ),
      ),
    ).rejects.toBeInstanceOf(LucidTenancyConfigurationError);

    // Central nested inside a tenant scope must also fail closed.
    await expect(
      manager.runWithTenant({ id: "a" }, () =>
        adapter.run(() =>
          manager.runInCentralContext(() => adapter.run(() => 1)),
        ),
      ),
    ).rejects.toBeInstanceOf(LucidTenancyConfigurationError);
  });

  it("attaches and scopes find, fetch, and both pagination queries", async () => {
    const manager = new TenancyManager();
    const model = createFakeModel("Post", "posts");
    const database = createFakeDatabase();
    const adapter = createLucidTenancy({
      manager,
      database: database.database,
      tenantModels: [{ model: model.model }],
    });
    await adapter.validate();
    const queries = [
      createFakeQuery(),
      createFakeQuery(),
      createFakeQuery(),
      createFakeQuery(),
    ];

    await manager.runWithTenant({ id: "tenant-a" }, () =>
      adapter.run(async () => {
        await model.hook("find")(queries[0]);
        await model.hook("fetch")(queries[1]);
        await model.hook("paginate")([queries[2], queries[3]]);
      }),
    );

    for (const query of queries) {
      expect(query.useTransaction).toHaveBeenCalledTimes(1);
      expect(query.where).toHaveBeenCalledWith("tenant_id", "tenant-a");
    }
  });

  it("retains transaction scope when callbacks return deferred Lucid thenables", async () => {
    const manager = new TenancyManager();
    const model = createFakeModel("Post", "posts");
    const database = createFakeDatabase();
    const adapter = createLucidTenancy({
      manager,
      database: database.database,
      tenantModels: [{ model: model.model }],
    });
    await adapter.validate();
    const query = createFakeQuery();
    const deferred = {
      then(resolve: (value: string) => void, reject: (error: unknown) => void) {
        try {
          model.hook("fetch")(query);
          resolve("scoped");
        } catch (error) {
          reject(error);
        }
      },
    } as Promise<string>;

    await expect(
      manager.runWithTenant({ id: "tenant-a" }, () =>
        adapter.run(() => deferred),
      ),
    ).resolves.toBe("scoped");
    expect(query.where).toHaveBeenCalledWith("tenant_id", "tenant-a");
    expect(query.useTransaction).toHaveBeenCalledTimes(1);
  });

  it("injects the tenant on create and rejects create/update discriminator changes", async () => {
    const manager = new TenancyManager();
    const model = createFakeModel("Post", "posts");
    const database = createFakeDatabase();
    const adapter = createLucidTenancy({
      manager,
      database: database.database,
      tenantModels: [{ model: model.model }],
    });
    await adapter.validate();
    const created = createFakeRow({ isNew: true });

    await manager.runWithTenant({ id: "tenant-a" }, () =>
      adapter.run(async () => {
        await model.hook("save")(created.row);
        expect(created.attributes.tenantId).toBe("tenant-a");
        expect(created.useTransaction).toHaveBeenCalledTimes(1);

        const conflictingCreate = createFakeRow({
          isNew: true,
          attributes: { tenantId: "tenant-b" },
        });
        expect(() => model.hook("save")(conflictingCreate.row)).toThrow(
          LucidTenantFieldConflictError,
        );

        const conflictingUpdate = createFakeRow({
          isNew: false,
          attributes: { tenantId: "tenant-a" },
          dirty: { tenantId: "tenant-b" },
        });
        expect(() => model.hook("save")(conflictingUpdate.row)).toThrow(
          LucidTenantFieldConflictError,
        );
        const validUpdate = createFakeRow({
          isNew: false,
          attributes: { tenantId: "tenant-a" },
          dirty: { title: "updated" },
        });
        expect(() => model.hook("save")(validUpdate.row)).not.toThrow();
      }),
    );
  });

  it("attaches deletes, supports explicit central context, and nests with a savepoint", async () => {
    const manager = new TenancyManager();
    const model = createFakeModel("Post", "posts");
    const database = createFakeDatabase();
    const adapter = createLucidTenancy({
      manager,
      database: database.database,
      tenantModels: [{ model: model.model }],
    });
    await adapter.validate();
    const centralQuery = createFakeQuery();
    const deleted = createFakeRow({ isNew: false });
    const centralCreate = createFakeRow({ isNew: true });

    await manager.runInCentralContext(() =>
      adapter.run(async () => {
        await model.hook("find")(centralQuery);
        await model.hook("delete")(deleted.row);
        await model.hook("save")(centralCreate.row);
        await adapter.run(() => undefined);
      }),
    );

    expect(centralQuery.where).not.toHaveBeenCalled();
    expect(centralQuery.useTransaction).toHaveBeenCalledTimes(1);
    expect(deleted.useTransaction).toHaveBeenCalledTimes(1);
    expect(centralCreate.attributes.tenantId).toBeUndefined();
    expect(database.savepointCalls).toHaveBeenCalledTimes(1);
    expect(database.transactionRawQuery).toHaveBeenLastCalledWith(
      "select set_config(?, ?, true), set_config(?, ?, true)",
      ["tenancyjs.tenant_id", "", "tenancyjs.is_central", "true"],
    );
  });

  it("fails model hooks outside the managed callback before model SQL", async () => {
    const manager = new TenancyManager();
    const model = createFakeModel("Post", "posts");
    createLucidTenancy({
      manager,
      database: createFakeDatabase().database,
      tenantModels: [{ model: model.model }],
    });
    const query = createFakeQuery();

    await expect(
      manager.runWithTenant({ id: "tenant-a" }, () =>
        model.hook("find")(query),
      ),
    ).rejects.toBeInstanceOf(LucidScopeError);
    expect(query.useTransaction).not.toHaveBeenCalled();
  });

  it("locks after failed or thrown validation without leaking introspection details", async () => {
    const manager = new TenancyManager();
    const model = createFakeModel("Post", "posts");
    const database = createFakeDatabase();
    database.policyRows = [];
    const adapter = createLucidTenancy({
      manager,
      database: database.database,
      tenantModels: [{ model: model.model }],
    });

    const invalid = await adapter.validate();
    expect(invalid.valid).toBe(false);
    expect(invalid.issues.map((entry) => entry.code)).toEqual([
      "TENANCY_LUCID_TABLE_MISSING",
    ]);
    database.failValidation = true;
    const failed = await adapter.validate();
    expect(failed).toEqual({
      valid: false,
      issues: [
        {
          code: "TENANCY_LUCID_POLICY_INTROSPECTION_FAILED",
          severity: "error",
          message:
            "Lucid tenancy could not verify the PostgreSQL RLS contract.",
        },
      ],
    });
    expect(JSON.stringify(failed)).not.toContain("postgresql://");
    await expect(
      manager.runWithTenant({ id: "tenant-a" }, () =>
        adapter.run(() => undefined),
      ),
    ).rejects.toBeInstanceOf(LucidPolicyValidationError);
  });

  it("reports privileged roles, ownership, unforced RLS, and invalid policies", async () => {
    const manager = new TenancyManager();
    const model = createFakeModel("Post", "posts");
    const database = createFakeDatabase();
    database.roleRows = [
      { role_name: "app_role", rolsuper: true, rolbypassrls: false },
    ];
    database.policyRows = [
      {
        schema_name: "public",
        table_name: "posts",
        rls_enabled: true,
        rls_forced: false,
        owner_name: "app_role",
        policy_name: "posts_tenant_isolation",
        using_expression: null,
        check_expression: null,
      },
    ];
    const adapter = createLucidTenancy({
      manager,
      database: database.database,
      tenantModels: [{ model: model.model }],
    });

    const result = await adapter.validate();
    expect(result.valid).toBe(false);
    expect(result.issues.map((entry) => entry.code)).toEqual([
      "TENANCY_LUCID_PRIVILEGED_ROLE",
      "TENANCY_LUCID_RLS_NOT_FORCED",
      "TENANCY_LUCID_ROLE_OWNS_TABLE",
      "TENANCY_LUCID_POLICY_INVALID",
    ]);

    database.roleRows = [];
    const missingRole = await adapter.validate();
    expect(missingRole.issues[0]?.code).toBe("TENANCY_LUCID_PRIVILEGED_ROLE");
  });

  it("rejects protected execution without tenant context or a callback", async () => {
    const model = createFakeModel("Post", "posts");
    const adapter = createLucidTenancy({
      manager: new TenancyManager(),
      database: createFakeDatabase().database,
      tenantModels: [{ model: model.model }],
    });
    await adapter.validate();

    await expect(adapter.run(() => undefined)).rejects.toMatchObject({
      code: "TENANCY_CONTEXT_UNAVAILABLE",
    });
    await expect(
      adapter.config.manager.runWithTenant({ id: "tenant-a" }, () =>
        adapter.run(undefined as unknown as () => undefined),
      ),
    ).rejects.toBeInstanceOf(LucidTenancyConfigurationError);
  });
});

function createFakeModel(name: string, table: string): FakeModelHarness {
  const hooks = new Map<string, Hook>();
  class FakeModel {}
  Object.defineProperty(FakeModel, "name", { value: name });
  Object.assign(FakeModel, {
    table,
    boot: vi.fn(),
    before: vi.fn((event: string, handler: Hook) => hooks.set(event, handler)),
  });
  const model = FakeModel as unknown as LucidModel;
  return {
    model,
    hook(event) {
      const hook = hooks.get(event);
      if (hook === undefined) throw new Error(`Missing ${event} hook`);
      return hook;
    },
  };
}

function createFakeDatabase(): FakeDatabaseHarness {
  const transactionRawQuery = vi.fn(async () => ({ rows: [] }));
  const savepointCalls = vi.fn(
    async (
      callback: (transaction: TransactionClientContract) => Promise<unknown>,
    ) => callback(transaction),
  );
  const transaction = {
    rawQuery: transactionRawQuery,
    transaction: savepointCalls,
  } as unknown as TransactionClientContract;
  const transactionCalls = vi.fn(
    async (
      callback: (transaction: TransactionClientContract) => Promise<unknown>,
    ) => callback(transaction),
  );
  const harness: FakeDatabaseHarness = {
    database: undefined as unknown as Database,
    transactionCalls,
    transactionRawQuery,
    savepointCalls,
    failValidation: false,
    roleRows: [
      {
        role_name: "app_role",
        rolsuper: false,
        rolbypassrls: false,
      },
    ],
    policyRows: [
      {
        schema_name: "public",
        table_name: "posts",
        rls_enabled: true,
        rls_forced: true,
        owner_name: "migration_role",
        policy_name: "posts_tenant_isolation",
        using_expression: "tenancyjs.tenant_id tenancyjs.is_central",
        check_expression: "tenancyjs.tenant_id tenancyjs.is_central",
      },
    ],
  };
  harness.database = {
    transaction: transactionCalls,
    rawQuery: vi.fn(async (sql: string) => {
      if (harness.failValidation) {
        throw new Error("postgresql://admin:secret@localhost/private");
      }
      if (sql.includes("current_setting")) {
        return { rows: [{ probe: "__tenancyjs_probe__" }] };
      }
      return sql.includes("pg_roles")
        ? { rows: harness.roleRows }
        : { rows: harness.policyRows };
    }),
  } as unknown as Database;
  return harness;
}

function createFakeQuery() {
  return {
    useTransaction: vi.fn(),
    where: vi.fn(),
  };
}

function createFakeRow(options: {
  readonly isNew: boolean;
  readonly attributes?: Record<string, unknown>;
  readonly dirty?: Record<string, unknown>;
}) {
  const attributes = options.attributes ?? {};
  const useTransaction = vi.fn();
  const row = {
    $isNew: options.isNew,
    $dirty: options.dirty ?? {},
    $getAttribute: (key: string) => attributes[key],
    $setAttribute: (key: string, value: unknown) => {
      attributes[key] = value;
    },
    useTransaction,
  } as unknown as LucidRow;
  return { row, attributes, useTransaction };
}
