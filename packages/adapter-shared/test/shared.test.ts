import { describe, expect, it, vi } from "vitest";

import {
  POSTGRES_CENTRAL_SETTING,
  POSTGRES_TENANT_SETTING,
  PostgresStrategyValidationError,
  applyPostgresRowContext,
  assertSqlIdentifier,
  createPostgresStrategyEngine,
  decideTenantDiscriminator,
  normalizeQualifiedTable,
  validatePostgresRlsPolicies,
  type PostgresExecutor,
} from "../src/index.js";

describe("shared adapter identifiers", () => {
  it("normalizes PostgreSQL identifiers with an explicit qualification policy", () => {
    expect(assertSqlIdentifier("_tenant_2", { label: "Schema" })).toBe(
      "_tenant_2",
    );
    expect(
      normalizeQualifiedTable("posts", {
        label: "Table",
        defaultSchema: "public",
      }),
    ).toEqual({
      schema: "public",
      table: "posts",
      qualifiedName: "public.posts",
    });
    expect(
      normalizeQualifiedTable("tenant_a.posts", { label: "Table" }),
    ).toEqual({
      schema: "tenant_a",
      table: "posts",
      qualifiedName: "tenant_a.posts",
    });
  });

  it.each([
    ["leading underscore policy", "_Post", { allowLeadingUnderscore: false }],
    ["SQL punctuation", "tenant-a", {}],
    ["non-string", 1, {}],
  ])("rejects %s", (_name, value, options) => {
    expect(() =>
      assertSqlIdentifier(value, { label: "Identifier", ...options }),
    ).toThrow("valid SQL identifier");
  });

  it("rejects aliases, over-qualified names, and forbidden qualification with adapter errors", () => {
    class AdapterError extends Error {}
    for (const table of ["posts as p", "a.b.c", 1]) {
      expect(() =>
        normalizeQualifiedTable(table, {
          label: "Table",
          createError: (message) => new AdapterError(message),
        }),
      ).toThrow(AdapterError);
    }
    expect(() =>
      normalizeQualifiedTable("tenant_a.posts", {
        label: "Table",
        allowQualified: false,
      }),
    ).toThrow("unqualified");
  });
});

describe("shared tenant discriminator decision", () => {
  it("injects matching creates and rejects cross-tenant creates", () => {
    expect(
      decideTenantDiscriminator("tenant-a", "create", false, undefined),
    ).toEqual({ kind: "inject", value: "tenant-a" });
    expect(
      decideTenantDiscriminator("tenant-a", "create", true, "tenant-a"),
    ).toEqual({ kind: "inject", value: "tenant-a" });
    expect(
      decideTenantDiscriminator("tenant-a", "create", true, "tenant-b"),
    ).toEqual({ kind: "reject" });
  });

  it("rejects discriminator updates and preserves central data", () => {
    expect(
      decideTenantDiscriminator("tenant-a", "update", true, "tenant-a"),
    ).toEqual({ kind: "reject" });
    expect(
      decideTenantDiscriminator("tenant-a", "update", false, undefined),
    ).toEqual({ kind: "preserve" });
    expect(
      decideTenantDiscriminator(undefined, "create", true, "tenant-a"),
    ).toEqual({ kind: "preserve" });
  });
});

describe("shared PostgreSQL row-level enforcement", () => {
  it("validates the full forced-RLS contract once for every adapter", async () => {
    const result = await validatePostgresRlsPolicies({
      codePrefix: "TENANCY_TEST",
      adapterName: "Test",
      execute: rlsExecutor(),
      tables: [
        {
          schema: "app",
          table: "posts",
          qualifiedName: "app.posts",
          policyName: "posts_tenant_isolation",
        },
      ],
    });
    expect(result).toEqual({ valid: true, issues: [] });
  });

  it("reports every isolation defect without exposing query values", async () => {
    const execute: PostgresExecutor = async (sql) => {
      if (sql.includes("pg_roles")) {
        return {
          rows: [
            {
              role_name: "runtime",
              rolsuper: true,
              rolbypassrls: false,
            },
          ],
        };
      }
      return {
        rows: [
          {
            schema_name: "app",
            table_name: "posts",
            rls_enabled: false,
            rls_forced: false,
            owner_name: "runtime",
            policy_name: "wrong",
            using_expression: "true",
            check_expression: null,
          },
        ],
      };
    };
    const result = await validatePostgresRlsPolicies({
      codePrefix: "TENANCY_TEST",
      adapterName: "Test",
      execute,
      tables: [
        {
          schema: "app",
          table: "posts",
          qualifiedName: "app.posts",
          policyName: "posts_tenant_isolation",
        },
        {
          schema: "app",
          table: "comments",
          qualifiedName: "app.comments",
          policyName: "comments_tenant_isolation",
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.issues.map((entry) => entry.code)).toEqual([
      "TENANCY_TEST_PRIVILEGED_ROLE",
      "TENANCY_TEST_RLS_NOT_FORCED",
      "TENANCY_TEST_ROLE_OWNS_TABLE",
      "TENANCY_TEST_POLICY_INVALID",
      "TENANCY_TEST_TABLE_MISSING",
    ]);
  });

  it("treats malformed catalog results as invalid and applies local context", async () => {
    const invalid = await validatePostgresRlsPolicies({
      codePrefix: "TENANCY_TEST",
      adapterName: "Test",
      execute: async () => ({}),
      tables: [],
    });
    expect(invalid.issues[0]?.code).toBe("TENANCY_TEST_PRIVILEGED_ROLE");

    const execute = vi.fn<PostgresExecutor>(async () => ({ rows: [] }));
    await applyPostgresRowContext(execute, {
      mode: "tenant",
      tenant: { id: "tenant-a" },
    });
    await applyPostgresRowContext(execute, { mode: "central" });
    expect(execute).toHaveBeenNthCalledWith(
      1,
      "select set_config(?, ?, true), set_config(?, ?, true)",
      [POSTGRES_TENANT_SETTING, "tenant-a", POSTGRES_CENTRAL_SETTING, "false"],
    );
    expect(execute).toHaveBeenNthCalledWith(
      2,
      "select set_config(?, ?, true), set_config(?, ?, true)",
      [POSTGRES_TENANT_SETTING, "", POSTGRES_CENTRAL_SETTING, "true"],
    );
  });
});

describe("PostgreSQL schema-per-tenant strategy engine", () => {
  const options = {
    codePrefix: "TENANCY_TEST" as const,
    adapterName: "Test",
    resolveSchema: (tenant: { id: string }) => `tenant_${tenant.id}`,
    centralSchema: "public",
    tenantTables: ["posts"],
    centralTables: ["tenants"],
  };

  it("validates the central boundary and applies tenant-local search_path", async () => {
    const execute = vi.fn<PostgresExecutor>(schemaExecutor());
    const engine = createPostgresStrategyEngine(options);
    await expect(engine.validate(execute)).resolves.toEqual({
      valid: true,
      issues: [],
    });
    await engine.applyContext(execute, {
      mode: "tenant",
      tenant: { id: "a" },
    });
    expect(execute).toHaveBeenCalledWith(
      "select set_config('search_path', ?, true)",
      ["tenant_a"],
    );
  });

  it("applies the central schema only for explicit central context", async () => {
    const execute = vi.fn<PostgresExecutor>(schemaExecutor());
    const engine = createPostgresStrategyEngine(options);
    await engine.applyContext(execute, { mode: "central" });
    expect(execute).toHaveBeenCalledWith(
      "select set_config('search_path', ?, true)",
      ["public"],
    );
  });

  it("reports privileged, inaccessible, shadowing, and missing-central-table boundaries", async () => {
    const engine = createPostgresStrategyEngine(options);
    const result = await engine.validate(
      schemaExecutor({
        privileged: true,
        centralUsage: false,
        shadowTenantTable: true,
        shadowDefaultPath: true,
        missingCentralTable: true,
      }),
    );
    expect(result.issues.map((entry) => entry.code)).toEqual([
      "TENANCY_TEST_PRIVILEGED_ROLE",
      "TENANCY_TEST_CENTRAL_SCHEMA_INVALID",
      "TENANCY_TEST_CENTRAL_SCHEMA_SHADOWS_TENANT_TABLE",
      "TENANCY_TEST_DEFAULT_SEARCH_PATH_SHADOWS_TENANT_TABLE",
      "TENANCY_TEST_CENTRAL_TABLE_MISSING",
    ]);
  });

  it.each([
    ["central collision", (): string => "public", schemaExecutor()],
    ["invalid resolver output", (): string => "tenant-a", schemaExecutor()],
    [
      "resolver failure",
      (): never => {
        throw new Error("secret");
      },
      schemaExecutor(),
    ],
    [
      "missing schema",
      (): string => "missing",
      schemaExecutor({ missingSchema: true }),
    ],
    [
      "missing tenant table",
      (): string => "tenant_a",
      schemaExecutor({ missingTenantTable: true }),
    ],
    [
      "database failure",
      (): string => "tenant_a",
      async (): Promise<never> => {
        throw new Error("postgresql://secret");
      },
    ],
  ] as const)("fails closed for %s", async (_name, resolveSchema, execute) => {
    const engine = createPostgresStrategyEngine({ ...options, resolveSchema });
    await expect(
      engine.applyContext(execute, {
        mode: "tenant",
        tenant: { id: "a" },
      }),
    ).rejects.toEqual(new PostgresStrategyValidationError());
  });

  it("rejects invalid engine configuration", () => {
    expect(() =>
      createPostgresStrategyEngine({
        ...options,
        resolveSchema: null as never,
      }),
    ).toThrow("schema resolver");
    expect(() =>
      createPostgresStrategyEngine({ ...options, centralSchema: "bad-name" }),
    ).toThrow("valid SQL identifier");
    expect(() =>
      createPostgresStrategyEngine({
        ...options,
        tenantTables: ["posts", "posts"],
      }),
    ).toThrow("unique");
    expect(() =>
      createPostgresStrategyEngine({
        ...options,
        centralTables: null as never,
      }),
    ).toThrow("array");
  });
});

function rlsExecutor(): PostgresExecutor {
  return async (sql) =>
    sql.includes("pg_roles")
      ? {
          rows: [
            {
              role_name: "runtime",
              rolsuper: false,
              rolbypassrls: false,
            },
          ],
        }
      : {
          rows: [
            {
              schema_name: "app",
              table_name: "posts",
              rls_enabled: true,
              rls_forced: true,
              owner_name: "migrator",
              policy_name: "posts_tenant_isolation",
              using_expression: `${POSTGRES_TENANT_SETTING} ${POSTGRES_CENTRAL_SETTING}`,
              check_expression: `${POSTGRES_TENANT_SETTING} ${POSTGRES_CENTRAL_SETTING}`,
            },
          ],
        };
}

function schemaExecutor(
  options: Readonly<{
    privileged?: boolean;
    centralUsage?: boolean;
    shadowTenantTable?: boolean;
    shadowDefaultPath?: boolean;
    missingCentralTable?: boolean;
    missingSchema?: boolean;
    missingTenantTable?: boolean;
  }> = {},
): PostgresExecutor {
  return async (sql, bindings) => {
    if (sql.includes("pg_roles")) {
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
    if (sql.includes("has_schema_privilege")) {
      if (options.missingSchema && bindings?.[0] === "missing")
        return { rows: [] };
      return {
        rows: [
          {
            schema_name: bindings?.[0],
            has_usage:
              bindings?.[0] === "public"
                ? (options.centralUsage ?? true)
                : true,
          },
        ],
      };
    }
    if (sql.includes("c.relkind")) {
      if (sql.includes("current_schemas")) {
        return {
          rows: options.shadowDefaultPath
            ? [{ schema_name: "public", table_name: "posts" }]
            : [],
        };
      }
      const schema = bindings?.[0];
      const tables = bindings?.[1] as string[];
      if (schema === "public" && tables.includes("posts")) {
        return {
          rows: options.shadowTenantTable ? [{ table_name: "posts" }] : [],
        };
      }
      if (schema === "public" && tables.includes("tenants")) {
        return {
          rows: options.missingCentralTable ? [] : [{ table_name: "tenants" }],
        };
      }
      return {
        rows: options.missingTenantTable
          ? []
          : tables.map((table_name) => ({ table_name })),
      };
    }
    return { rows: [] };
  };
}
