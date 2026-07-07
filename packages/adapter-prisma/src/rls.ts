import {
  TenantContextError,
  type TenancyAdapterValidationResult,
  type TenancyManager,
  type TenantRecord,
} from "tenancyjs-core";
import {
  applyPostgresRowContext,
  validatePostgresRlsPolicies,
  type PostgresExecutor,
  type PostgresRlsTable,
} from "tenancyjs-adapter-shared";

import { PrismaTenancyConfigurationError } from "./errors.js";

/**
 * A tenant table for the RLS-backed Prisma row-level path (ADR-0037). Unlike the
 * facade extension, isolation here is enforced by forced PostgreSQL RLS: the
 * scope runs in an interactive transaction whose tenant GUC is `SET LOCAL`, so
 * every statement - including raw SQL and nested relation reads - is bound to the
 * current tenant by the validated policy.
 */
export interface PrismaRlsTableConfig {
  /** The Prisma model name (e.g. "Post"), used to inject the tenant on writes. */
  readonly model: string;
  /** The database table (e.g. "posts"), used to validate the RLS contract. */
  readonly table: string;
  /** The tenant discriminator column (e.g. "tenant_id"). */
  readonly tenantColumn: string;
  /** The Prisma field for the discriminator. Defaults to `tenantColumn`. */
  readonly tenantField?: string;
  /** The table's schema. Defaults to "public". */
  readonly schema?: string;
  /** The policy name. Defaults to `${table}_tenant_isolation`. */
  readonly policyName?: string;
}

/** The minimal Prisma client surface the RLS path needs. */
export interface PrismaRlsClient {
  $extends(extension: unknown): PrismaRlsClient;
  $transaction<TResult>(
    fn: (tx: unknown) => Promise<TResult>,
  ): Promise<TResult>;
  $queryRawUnsafe(sql: string, ...values: unknown[]): Promise<unknown>;
}

export interface PrismaRowLevelTenancyOptions<
  TTenant extends TenantRecord,
  TClient extends PrismaRlsClient,
> {
  readonly manager: TenancyManager<TTenant>;
  /** The base PrismaClient, built with a driver adapter (e.g. `@prisma/adapter-pg`). */
  readonly client: TClient;
  readonly tables: readonly PrismaRlsTableConfig[];
}

export interface PrismaRowLevelTenancy<TClient extends PrismaRlsClient> {
  readonly name: "prisma";
  readonly strategy: "rowLevel";
  validate(): Promise<TenancyAdapterValidationResult>;
  /**
   * Run scoped work inside a tenant transaction. Opens a Prisma interactive
   * transaction, `SET LOCAL`s the tenant GUC, and passes the transaction client
   * to the callback. Full query freedom (raw SQL, joins, nested relations) - the
   * validated RLS policy binds every statement to the current tenant. Fails
   * closed when there is no tenant scope.
   */
  run<TResult>(callback: (tx: TClient) => Promise<TResult>): Promise<TResult>;
}

interface ResolvedRlsTable {
  readonly model: string;
  readonly tenantField: string;
  readonly rls: PostgresRlsTable;
}

interface QueryExtensionParameters {
  readonly model?: string;
  readonly operation: string;
  readonly args: unknown;
  readonly query: (args: unknown) => Promise<unknown>;
}

// Prisma's $queryRawUnsafe uses $1 positional placeholders and returns the row
// array directly; the shared Postgres engine speaks `?` placeholders and reads a
// `{ rows }` shape (via resultRows). Bridge both here.
function prismaExecutor(client: PrismaRlsClient): PostgresExecutor {
  return async (sql, bindings) => {
    let index = 0;
    const positional = sql.replace(/\?/g, () => `$${(index += 1)}`);
    const rows = await client.$queryRawUnsafe(positional, ...(bindings ?? []));
    return { rows };
  };
}

function injectTenantOnWrite(
  operation: string,
  args: unknown,
  tenantField: string,
  tenantId: string,
): unknown {
  const record = (args ?? {}) as Record<string, unknown>;
  if (operation === "create") {
    return {
      ...record,
      data: { ...(record.data as object), [tenantField]: tenantId },
    };
  }
  if (operation === "createMany") {
    const data = record.data;
    const rows = Array.isArray(data) ? data : [data];
    return {
      ...record,
      data: rows.map((row) => ({
        ...(row as object),
        [tenantField]: tenantId,
      })),
    };
  }
  if (operation === "upsert") {
    return {
      ...record,
      create: { ...(record.create as object), [tenantField]: tenantId },
    };
  }
  return args;
}

const WRITE_INJECT_OPERATIONS = new Set(["create", "createMany", "upsert"]);

export function createPrismaRowLevelTenancy<
  TTenant extends TenantRecord = TenantRecord,
  TClient extends PrismaRlsClient = PrismaRlsClient,
>(
  options: PrismaRowLevelTenancyOptions<TTenant, TClient>,
): PrismaRowLevelTenancy<TClient> {
  const { manager } = options;
  const tables: readonly ResolvedRlsTable[] = Object.freeze(
    options.tables.map((table) => {
      const schema = table.schema ?? "public";
      return Object.freeze({
        model: table.model,
        tenantField: table.tenantField ?? table.tenantColumn,
        rls: Object.freeze({
          schema,
          table: table.table,
          // The validator matches `nspname || '.' || relname`, so this is always
          // schema-qualified, including for the public schema.
          qualifiedName: `${schema}.${table.table}`,
          policyName: table.policyName ?? `${table.table}_tenant_isolation`,
        }),
      });
    }),
  );
  const fieldByModel = new Map(tables.map((t) => [t.model, t.tenantField]));

  // The RLS extension: isolation is the database policy, so reads, nested
  // relations, and raw SQL all pass through (RLS filters every returned row).
  // We only inject the tenant discriminator on writes so the policy's WITH CHECK
  // accepts them without the caller repeating the tenant id.
  const extension = Object.freeze({
    name: "tenancyjs-rls-row-level",
    query: Object.freeze({
      async $allOperations({
        model,
        operation,
        args,
        query,
      }: QueryExtensionParameters): Promise<unknown> {
        const tenantField =
          model === undefined ? undefined : fieldByModel.get(model);
        if (
          tenantField === undefined ||
          !WRITE_INJECT_OPERATIONS.has(operation)
        ) {
          return query(args);
        }
        const context = manager.getContext();
        if (context === undefined) throw new TenantContextError("missing");
        if (context.mode === "central") return query(args);
        return query(
          injectTenantOnWrite(operation, args, tenantField, context.tenant.id),
        );
      },
    }),
  });

  const scopedClient = options.client.$extends(extension) as TClient &
    PrismaRlsClient;
  let validated = false;

  async function validate(): Promise<TenancyAdapterValidationResult> {
    const result = await validatePostgresRlsPolicies({
      codePrefix: "TENANCY_PRISMA",
      adapterName: "Prisma",
      execute: prismaExecutor(options.client),
      tables: tables.map((t) => t.rls),
    });
    validated = result.valid;
    return result;
  }

  async function run<TResult>(
    callback: (tx: TClient) => Promise<TResult>,
  ): Promise<TResult> {
    if (!validated) {
      throw new PrismaTenancyConfigurationError(
        "Call validate() and confirm the forced-RLS policy contract before run().",
      );
    }
    const context = manager.getContext();
    if (context === undefined) throw new TenantContextError("missing");
    return scopedClient.$transaction(async (tx) => {
      // SET LOCAL the tenant GUC on this transaction's connection, so the
      // validated policy binds every subsequent statement to the tenant.
      await applyPostgresRowContext(
        prismaExecutor(tx as PrismaRlsClient),
        context,
      );
      return callback(tx as TClient);
    });
  }

  return Object.freeze({
    name: "prisma" as const,
    strategy: "rowLevel" as const,
    validate,
    run,
  });
}
