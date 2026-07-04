import { TenancyManager, TenantContextError } from "@tenancyjs/core";
import type { Knex } from "knex";
import { describe, expect, it, vi } from "vitest";

import {
  KNEX_ADAPTER_CAPABILITIES,
  KNEX_CENTRAL_SETTING,
  KNEX_TENANT_SETTING,
  KnexPolicyValidationError,
  KnexTenantFieldConflictError,
  KnexTenancyConfigurationError,
  KnexUnregisteredTableError,
  KnexUnsupportedOperationError,
  classifyKnexTable,
  createKnexTenancy,
  defineKnexTenancyConfig,
} from "../src/index.js";

interface Tenant {
  readonly id: string;
  readonly name: string;
}

interface RecordedQuery {
  readonly table: string;
  readonly calls: Array<readonly [string, ...unknown[]]>;
}

function createKnexDouble(
  options: {
    readonly privileged?: boolean;
    readonly missingTable?: boolean;
    readonly invalidPolicy?: boolean;
    readonly unforced?: boolean;
    readonly ownsTable?: boolean;
    readonly malformedResult?: boolean;
    readonly validationError?: boolean;
  } = {},
) {
  const queries: RecordedQuery[] = [];
  const transactionRaw = vi.fn(async () => ({ rows: [] }));
  const savepointRaw = vi.fn(async () => ({ rows: [] }));

  function queryBuilder(table: string) {
    const recorded: RecordedQuery = { table, calls: [] };
    queries.push(recorded);
    const result = Object.freeze([{ id: "result" }]);
    const builder: Record<string, unknown> = {};
    for (const method of [
      "where",
      "whereIn",
      "orderBy",
      "limit",
      "offset",
      "select",
      "first",
      "count",
      "min",
      "max",
      "sum",
      "avg",
      "insert",
      "update",
      "delete",
      "returning",
    ]) {
      builder[method] = (...arguments_: unknown[]) => {
        recorded.calls.push([method, ...arguments_]);
        return builder;
      };
    }
    builder.then = (
      fulfilled: (value: unknown) => unknown,
      rejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(fulfilled, rejected);
    return builder;
  }

  function transaction(table: string) {
    return queryBuilder(table);
  }
  const transactionMethod = async (
    callback: (savepoint: Knex.Transaction) => unknown,
  ) => {
    function savepoint(table: string) {
      return queryBuilder(table);
    }
    Object.assign(savepoint, {
      raw: savepointRaw,
      transaction: transactionMethod,
    });
    return callback(savepoint as unknown as Knex.Transaction);
  };
  Object.assign(transaction, {
    raw: transactionRaw,
    transaction: transactionMethod,
  });

  const raw = vi.fn(async (_sql: string, bindings?: unknown[]) => {
    if (options.validationError)
      throw new Error("postgresql://user:secret@db/private");
    if (bindings === undefined) {
      if (options.malformedResult) return {};
      return {
        rows: [
          {
            role_name: "runtime",
            rolsuper: options.privileged ?? false,
            rolbypassrls: false,
          },
        ],
      };
    }
    if (options.missingTable) return { rows: [] };
    return {
      rows: [
        {
          schema_name: "app",
          table_name: "posts",
          rls_enabled: !(options.unforced ?? false),
          rls_forced: !(options.unforced ?? false),
          owner_name: options.ownsTable ? "runtime" : "migrator",
          policy_name: "posts_tenant_isolation",
          using_expression: options.invalidPolicy
            ? "true"
            : `${KNEX_TENANT_SETTING} ${KNEX_CENTRAL_SETTING}`,
          check_expression: `${KNEX_TENANT_SETTING} ${KNEX_CENTRAL_SETTING}`,
        },
      ],
    };
  });

  function knexDouble() {
    throw new Error("The base callable must remain private.");
  }
  Object.assign(knexDouble, {
    raw,
    transaction: async (callback: (trx: Knex.Transaction) => unknown) =>
      callback(transaction as unknown as Knex.Transaction),
  });

  return {
    knex: knexDouble as unknown as Knex,
    queries,
    raw,
    savepointRaw,
    transactionRaw,
  };
}

function createFixture(double = createKnexDouble()) {
  const manager = new TenancyManager<Tenant>();
  const adapter = createKnexTenancy({
    manager,
    knex: double.knex,
    tenantTables: { "app.posts": {} },
    centralTables: { "app.tenants": {} },
  });
  return { adapter, double, manager };
}

describe("Knex tenancy configuration", () => {
  it("normalizes and freezes table classification", () => {
    const manager = new TenancyManager();
    const { knex } = createKnexDouble();
    const config = defineKnexTenancyConfig({
      manager,
      knex,
      tenantTables: { posts: {} },
      centralTables: { tenants: {} },
    });

    expect(config.tenantTables["public.posts"]).toEqual({
      schema: "public",
      table: "posts",
      qualifiedName: "public.posts",
      tenantColumn: "tenant_id",
      policyName: "posts_tenant_isolation",
    });
    expect(classifyKnexTable(config, "posts").kind).toBe("tenant");
    expect(classifyKnexTable(config, "tenants").kind).toBe("central");
    expect(Object.isFrozen(config.tenantTables)).toBe(true);
    expect(() => classifyKnexTable(config, "secrets")).toThrow(
      KnexUnregisteredTableError,
    );
  });

  it.each([
    ["options", null],
    [
      "manager",
      {
        manager: null,
        knex: createKnexDouble().knex,
        tenantTables: { posts: {} },
      },
    ],
    [
      "knex",
      { manager: new TenancyManager(), knex: {}, tenantTables: { posts: {} } },
    ],
    [
      "tenant tables",
      {
        manager: new TenancyManager(),
        knex: createKnexDouble().knex,
        tenantTables: {},
      },
    ],
    [
      "tenant table map",
      {
        manager: new TenancyManager(),
        knex: createKnexDouble().knex,
        tenantTables: [],
      },
    ],
    [
      "tenant table entry",
      {
        manager: new TenancyManager(),
        knex: createKnexDouble().knex,
        tenantTables: { posts: null },
      },
    ],
    [
      "invalid table",
      {
        manager: new TenancyManager(),
        knex: createKnexDouble().knex,
        tenantTables: { "posts as p": {} },
      },
    ],
    [
      "invalid column",
      {
        manager: new TenancyManager(),
        knex: createKnexDouble().knex,
        tenantTables: { posts: { tenantColumn: "tenant-id" } },
      },
    ],
    [
      "invalid policy",
      {
        manager: new TenancyManager(),
        knex: createKnexDouble().knex,
        tenantTables: { posts: { policyName: "bad policy" } },
      },
    ],
    [
      "central map",
      {
        manager: new TenancyManager(),
        knex: createKnexDouble().knex,
        tenantTables: { posts: {} },
        centralTables: [],
      },
    ],
    [
      "central entry",
      {
        manager: new TenancyManager(),
        knex: createKnexDouble().knex,
        tenantTables: { posts: {} },
        centralTables: { tenants: null },
      },
    ],
    [
      "normalized duplicate",
      {
        manager: new TenancyManager(),
        knex: createKnexDouble().knex,
        tenantTables: { posts: {}, "public.posts": {} },
      },
    ],
    [
      "central normalized duplicate",
      {
        manager: new TenancyManager(),
        knex: createKnexDouble().knex,
        tenantTables: { posts: {} },
        centralTables: { tenants: {}, "public.tenants": {} },
      },
    ],
    [
      "overlap",
      {
        manager: new TenancyManager(),
        knex: createKnexDouble().knex,
        tenantTables: { posts: {} },
        centralTables: { posts: {} },
      },
    ],
  ])("rejects invalid %s configuration", (_name, input) => {
    expect(() => defineKnexTenancyConfig(input as never)).toThrow(
      KnexTenancyConfigurationError,
    );
  });

  it("publishes a conservative capability matrix", () => {
    expect(KNEX_ADAPTER_CAPABILITIES).toEqual({
      rowLevel: "supported",
      schemaPerTenant: "unsupported",
      databasePerTenant: "unsupported",
      centralModels: "supported",
      transactions: "supported",
      nestedReads: "rejected",
      nestedWrites: "rejected",
      rawQueries: "rejected",
    });
  });
});

describe("PostgreSQL RLS validation", () => {
  it("unlocks execution only after the full policy contract passes", async () => {
    const { adapter, manager } = createFixture();
    await expect(
      manager.runWithTenant({ id: "tenant-a", name: "A" }, () =>
        adapter.run(vi.fn()),
      ),
    ).rejects.toBeInstanceOf(KnexPolicyValidationError);

    await expect(adapter.validate()).resolves.toEqual({
      valid: true,
      issues: [],
    });
    await expect(
      manager.runWithTenant({ id: "tenant-a", name: "A" }, () =>
        adapter.run(() => "ok"),
      ),
    ).resolves.toBe("ok");
  });

  it.each([
    ["privileged role", { privileged: true }, "TENANCY_KNEX_PRIVILEGED_ROLE"],
    ["missing table", { missingTable: true }, "TENANCY_KNEX_TABLE_MISSING"],
    ["invalid policy", { invalidPolicy: true }, "TENANCY_KNEX_POLICY_INVALID"],
    ["unforced RLS", { unforced: true }, "TENANCY_KNEX_RLS_NOT_FORCED"],
    ["runtime ownership", { ownsTable: true }, "TENANCY_KNEX_ROLE_OWNS_TABLE"],
    [
      "malformed catalog result",
      { malformedResult: true },
      "TENANCY_KNEX_PRIVILEGED_ROLE",
    ],
  ] as const)(
    "reports %s without unlocking execution",
    async (_name, options, code) => {
      const { adapter, manager } = createFixture(createKnexDouble(options));
      const result = await adapter.validate();
      expect(result.valid).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code })]),
      );
      await expect(
        manager.runWithTenant({ id: "tenant-a", name: "A" }, () =>
          adapter.run(vi.fn()),
        ),
      ).rejects.toBeInstanceOf(KnexPolicyValidationError);
    },
  );

  it("sanitizes introspection failures", async () => {
    const { adapter } = createFixture(
      createKnexDouble({ validationError: true }),
    );
    const result = await adapter.validate();
    expect(result).toEqual({
      valid: false,
      issues: [
        expect.objectContaining({
          code: "TENANCY_KNEX_POLICY_INTROSPECTION_FAILED",
        }),
      ],
    });
    expect(JSON.stringify(result)).not.toContain("secret");
  });
});

describe("protected Knex execution", () => {
  it("adds tenant and caller predicates and configures transaction-local context", async () => {
    const { adapter, double, manager } = createFixture();
    await adapter.validate();
    const result = await manager.runWithTenant(
      { id: "tenant-a", name: "A" },
      () =>
        adapter.run((db) =>
          db
            .table("app.posts")
            .where("published", true)
            .orderBy("id", "desc")
            .limit(10)
            .select("id"),
        ),
    );

    expect(result).toEqual([{ id: "result" }]);
    expect(double.transactionRaw).toHaveBeenCalledWith(expect.any(String), [
      KNEX_TENANT_SETTING,
      "tenant-a",
      KNEX_CENTRAL_SETTING,
      "false",
    ]);
    expect(double.queries[0]).toEqual({
      table: "app.posts",
      calls: [
        ["where", "tenant_id", "tenant-a"],
        ["where", "published", true],
        ["orderBy", "id", "desc"],
        ["limit", 10],
        ["select", "id"],
      ],
    });
  });

  it("injects tenant ownership and rejects conflicting inserts and updates", async () => {
    const { adapter, double, manager } = createFixture();
    await adapter.validate();
    await manager.runWithTenant({ id: "tenant-a", name: "A" }, () =>
      adapter.run(async (db) => {
        await db.table("app.posts").insert({ title: "safe" }).returning("id");
        await expect(
          db.table("app.posts").insert({ tenant_id: "tenant-b", title: "bad" }),
        ).rejects.toBeInstanceOf(KnexTenantFieldConflictError);
        await expect(
          db.table("app.posts").update({ tenant_id: "tenant-a" }),
        ).rejects.toBeInstanceOf(KnexTenantFieldConflictError);
      }),
    );

    expect(double.queries[0]!.calls).toContainEqual([
      "insert",
      { tenant_id: "tenant-a", title: "safe" },
    ]);
  });

  it("supports central context, central tables, and nested savepoints explicitly", async () => {
    const { adapter, double, manager } = createFixture();
    await adapter.validate();
    await manager.runInCentralContext(() =>
      adapter.run(async (db) => {
        await db.table("app.posts").count();
        await db.transaction((nested) =>
          nested.table("app.tenants").whereIn("id", ["a", "b"]).first(),
        );
      }),
    );

    expect(double.transactionRaw).toHaveBeenCalledWith(expect.any(String), [
      KNEX_TENANT_SETTING,
      "",
      KNEX_CENTRAL_SETTING,
      "true",
    ]);
    expect(double.savepointRaw).toHaveBeenCalledOnce();
    expect(double.queries[0]!.calls[0]).toEqual(["count", "*"]);
    expect(double.queries[1]!.calls).toEqual([
      ["whereIn", "id", ["a", "b"]],
      ["first", "*"],
    ]);
  });

  it("covers supported aggregate, mutation, returning, and pagination builders", async () => {
    const { adapter, manager } = createFixture();
    await adapter.validate();
    await manager.runWithTenant({ id: "tenant-a", name: "A" }, () =>
      adapter.run(async (db) => {
        await db.table("app.posts").min("score");
        await db.table("app.posts").max("score");
        await db.table("app.posts").sum("score");
        await db.table("app.posts").avg("score");
        await db.table("app.posts").offset(2).select();
        await db
          .table("app.posts")
          .where({ published: true })
          .update({ title: "updated" })
          .returning("id");
        await db
          .table("app.posts")
          .where("id", "post-a")
          .delete()
          .returning("id");
      }),
    );
  });

  it("rejects missing context, invalid callbacks, unclassified tables, and escape methods", async () => {
    const { adapter, manager } = createFixture();
    await adapter.validate();
    await expect(adapter.run(vi.fn())).rejects.toBeInstanceOf(
      TenantContextError,
    );
    await expect(
      manager.runWithTenant({ id: "tenant-a", name: "A" }, () =>
        adapter.run(null as never),
      ),
    ).rejects.toBeInstanceOf(KnexTenancyConfigurationError);
    await expect(
      manager.runWithTenant({ id: "tenant-a", name: "A" }, () =>
        adapter.run((db) => db.table("app.unknown")),
      ),
    ).rejects.toBeInstanceOf(KnexUnregisteredTableError);
    await expect(
      manager.runWithTenant({ id: "tenant-a", name: "A" }, () =>
        adapter.run((db) =>
          (db.table("app.posts") as unknown as { raw(): unknown }).raw(),
        ),
      ),
    ).rejects.toBeInstanceOf(KnexUnsupportedOperationError);
  });

  it("rejects raw values and invalid fluent arguments before query execution", async () => {
    const { adapter, double, manager } = createFixture();
    await adapter.validate();
    await manager.runWithTenant({ id: "tenant-a", name: "A" }, () =>
      adapter.run(async (db) => {
        expect(() =>
          db.table("app.posts").where("id", { raw: true } as never),
        ).toThrow(KnexTenancyConfigurationError);
        expect(() => db.table("app.posts").whereIn("id", [])).toThrow(
          KnexTenancyConfigurationError,
        );
        expect(() =>
          db.table("app.posts").orderBy("id", "sideways" as never),
        ).toThrow(KnexTenancyConfigurationError);
        expect(() => db.table("app.posts").limit(-1)).toThrow(
          KnexTenancyConfigurationError,
        );
        expect(() => db.table("app.posts").offset(1.5)).toThrow(
          KnexTenancyConfigurationError,
        );
        expect(() => db.table("app.posts").select("id as leaked")).toThrow(
          KnexTenancyConfigurationError,
        );
        expect(() => db.table("app.posts").returning()).toThrow(
          KnexTenancyConfigurationError,
        );
        expect(() => db.table("app.posts").insert([])).toThrow(
          KnexTenancyConfigurationError,
        );
        expect(() =>
          db.table("app.posts").insert(Object.create(null) as never),
        ).toThrow(KnexTenancyConfigurationError);
        expect(() => db.table("app.posts").update({})).toThrow(
          KnexTenancyConfigurationError,
        );
        await expect(
          db.table("app.posts").select().returning("id"),
        ).rejects.toBeInstanceOf(KnexUnsupportedOperationError);
        expect(() => (db as unknown as { raw(): unknown }).raw()).toThrow(
          KnexUnsupportedOperationError,
        );
        expect(
          (db.table("app.posts") as unknown as Record<symbol, unknown>)[
            Symbol.toStringTag
          ],
        ).toBeUndefined();
      }),
    );
    expect(double.queries).toHaveLength(1);
  });

  it("executes a thenable query only once and propagates callback failures", async () => {
    const { adapter, double, manager } = createFixture();
    await adapter.validate();
    await manager.runWithTenant({ id: "tenant-a", name: "A" }, () =>
      adapter.run(async (db) => {
        const query = db.table("app.posts").select();
        await query;
        await query;
      }),
    );
    expect(double.queries).toHaveLength(1);

    const failure = new Error("handler failed");
    await expect(
      manager.runWithTenant({ id: "tenant-a", name: "A" }, () =>
        adapter.run(() => {
          throw failure;
        }),
      ),
    ).rejects.toBe(failure);
  });
});
