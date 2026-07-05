import type { TenancyManager, TenantRecord } from "tenancyjs-core";
import {
  assertSqlIdentifier,
  normalizeQualifiedTable,
} from "tenancyjs-adapter-shared";
import type { DataSource, EntityTarget, ObjectLiteral } from "typeorm";

import { TypeOrmTenancyConfigurationError } from "./errors.js";
import type {
  TypeOrmCentralEntityConfig,
  TypeOrmDatabasePlacement,
  TypeOrmTenantEntityConfig,
} from "./types.js";

const DEFAULT_MAX_CONNECTIONS = 25;

export interface TypeOrmTenancyOptions<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly manager: TenancyManager<TTenant>;
  readonly dataSource: DataSource;
  readonly dialect?: "postgresql" | "mysql";
  readonly tenantEntities: readonly TypeOrmTenantEntityConfig[];
  readonly centralEntities?: readonly TypeOrmCentralEntityConfig[];
  readonly strategy?: "rowLevel" | "schemaPerTenant" | "databasePerTenant";
  readonly schema?: (tenant: TTenant) => string;
  readonly centralSchema?: string;
  readonly role?: (tenant: TTenant) => string;
  readonly connection?: (tenant: TTenant) => TypeOrmDatabasePlacement;
  readonly maxConnections?: number;
}

export interface NormalizedTypeOrmTenantEntityConfig {
  readonly entity: EntityTarget<ObjectLiteral>;
  readonly schema: string | undefined;
  readonly table: string;
  readonly qualifiedName: string;
  readonly tenantProperty: string;
  readonly tenantColumn: string;
  readonly policyName: string;
}

export type TypeOrmEntityPolicy =
  | Readonly<{ kind: "tenant"; config: NormalizedTypeOrmTenantEntityConfig }>
  | Readonly<{ kind: "central"; entity: EntityTarget<ObjectLiteral> }>;

export interface TypeOrmTenancyConfig<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly manager: TenancyManager<TTenant>;
  readonly dataSource: DataSource;
  readonly dialect: "postgresql" | "mysql";
  readonly strategy: "rowLevel" | "schemaPerTenant" | "databasePerTenant";
  readonly schema: ((tenant: TTenant) => string) | undefined;
  readonly centralSchema: string;
  readonly role: ((tenant: TTenant) => string) | undefined;
  readonly connection:
    ((tenant: TTenant) => TypeOrmDatabasePlacement) | undefined;
  readonly maxConnections: number;
  readonly tenantEntities: readonly Readonly<NormalizedTypeOrmTenantEntityConfig>[];
  classify(
    entity: EntityTarget<ObjectLiteral>,
  ): TypeOrmEntityPolicy | undefined;
}

export function defineTypeOrmTenancyConfig<
  TTenant extends TenantRecord = TenantRecord,
>(options: TypeOrmTenancyOptions<TTenant>): TypeOrmTenancyConfig<TTenant> {
  if (options === null || typeof options !== "object")
    configuration("options are required");
  if (typeof options.manager?.getContext !== "function")
    configuration("requires a TenancyManager");
  if (typeof options.dataSource?.transaction !== "function")
    configuration("requires a DataSource");
  const strategy = options.strategy ?? "rowLevel";
  const dialect = options.dialect ?? "postgresql";
  if (dialect !== "postgresql" && dialect !== "mysql")
    configuration("dialect must be postgresql or mysql");
  if (strategy === "schemaPerTenant" && dialect !== "postgresql")
    configuration(
      "schema-per-tenant is PostgreSQL-only; use database-per-tenant for MySQL",
    );
  const configuredType = options.dataSource.options?.type;
  if (
    configuredType !== undefined &&
    !matchesTypeOrmDialect(configuredType, dialect)
  )
    configuration("dialect does not match the DataSource type");
  if (
    strategy !== "rowLevel" &&
    strategy !== "schemaPerTenant" &&
    strategy !== "databasePerTenant"
  ) {
    configuration(
      "strategy must be rowLevel, schemaPerTenant, or databasePerTenant",
    );
  }
  if (strategy === "schemaPerTenant" && typeof options.schema !== "function")
    configuration("schema-per-tenant requires a schema resolver");
  if (strategy !== "schemaPerTenant" && options.schema !== undefined)
    configuration("only schema-per-tenant accepts a schema resolver");
  if (strategy !== "schemaPerTenant" && options.centralSchema !== undefined)
    configuration("only schema-per-tenant accepts a central schema");
  if (strategy !== "schemaPerTenant" && options.role !== undefined)
    configuration("only schema-per-tenant accepts a role resolver");
  if (
    strategy === "databasePerTenant" &&
    typeof options.connection !== "function"
  )
    configuration("database-per-tenant requires a connection resolver");
  if (strategy !== "databasePerTenant" && options.connection !== undefined)
    configuration("only database-per-tenant accepts a connection resolver");
  if (strategy !== "databasePerTenant" && options.maxConnections !== undefined)
    configuration("only database-per-tenant accepts maxConnections");
  const maxConnections = options.maxConnections ?? DEFAULT_MAX_CONNECTIONS;
  if (
    strategy === "databasePerTenant" &&
    (!Number.isSafeInteger(maxConnections) || maxConnections <= 0)
  )
    configuration("database-per-tenant requires a positive maxConnections");
  const centralSchema = assertSqlIdentifier(options.centralSchema ?? "public", {
    label: "TypeORM central schema",
    createError: () =>
      new TypeOrmTenancyConfigurationError(
        "TypeORM tenancy central schema must be a SQL identifier.",
      ),
  });
  if (
    !Array.isArray(options.tenantEntities) ||
    options.tenantEntities.length === 0
  ) {
    configuration("requires at least one tenant entity");
  }
  if (
    options.centralEntities !== undefined &&
    !Array.isArray(options.centralEntities)
  ) {
    configuration("centralEntities must be an array");
  }

  const policies = new Map<EntityTarget<ObjectLiteral>, TypeOrmEntityPolicy>();
  const tenantEntities = options.tenantEntities.map((entry) => {
    if (
      entry === null ||
      typeof entry !== "object" ||
      entry.entity === undefined
    ) {
      configuration("tenant entity entries require an entity and table");
    }
    let table;
    try {
      table = normalizeQualifiedTable(entry.table, {
        ...(strategy === "rowLevel" ? { defaultSchema: "public" } : {}),
        allowQualified: strategy === "rowLevel",
        label: "TypeORM tenant table",
      });
    } catch {
      configuration("tenant tables must be valid SQL identifiers");
    }
    const tenantProperty = identifier(
      entry.tenantProperty ?? "tenantId",
      "tenant property",
    );
    const tenantColumn = identifier(
      entry.tenantColumn ?? "tenant_id",
      "tenant column",
    );
    const policyName = identifier(
      entry.policyName ?? `${table.table}_tenant_isolation`,
      "policy name",
    );
    const normalized = Object.freeze({
      entity: entry.entity,
      schema: table.schema,
      table: table.table,
      qualifiedName: table.qualifiedName,
      tenantProperty,
      tenantColumn,
      policyName,
    });
    if (strategy === "schemaPerTenant") {
      if (typeof options.dataSource.getMetadata !== "function")
        configuration("schema-per-tenant requires initialized entity metadata");
      let metadata;
      try {
        metadata = options.dataSource.getMetadata(entry.entity);
      } catch {
        configuration("schema-per-tenant requires registered entity metadata");
      }
      if (metadata.schema !== undefined || metadata.tablePath.includes(".")) {
        configuration(
          "schema-per-tenant entities must not declare a fixed schema",
        );
      }
    }
    addPolicy(
      policies,
      entry.entity,
      Object.freeze({ kind: "tenant", config: normalized }),
    );
    return normalized;
  });
  for (const entry of options.centralEntities ?? []) {
    if (
      entry === null ||
      typeof entry !== "object" ||
      entry.entity === undefined
    ) {
      configuration("central entity entries require an entity");
    }
    addPolicy(
      policies,
      entry.entity,
      Object.freeze({ kind: "central", entity: entry.entity }),
    );
  }
  return Object.freeze({
    manager: options.manager,
    dataSource: options.dataSource,
    dialect,
    strategy,
    schema: options.schema,
    centralSchema,
    role: options.role,
    connection: options.connection,
    maxConnections,
    tenantEntities: Object.freeze(tenantEntities),
    classify: (entity: EntityTarget<ObjectLiteral>) => policies.get(entity),
  });
}

export function matchesTypeOrmDialect(
  type: DataSource["options"]["type"],
  dialect: "postgresql" | "mysql",
): boolean {
  return dialect === "postgresql" ? type === "postgres" : type === "mysql";
}

function addPolicy(
  policies: Map<EntityTarget<ObjectLiteral>, TypeOrmEntityPolicy>,
  entity: EntityTarget<ObjectLiteral>,
  policy: TypeOrmEntityPolicy,
): void {
  if (policies.has(entity))
    configuration("entities must be classified exactly once");
  policies.set(entity, policy);
}

function identifier(value: string, label: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value))
    configuration(`${label} must be a SQL identifier`);
  return value;
}

function configuration(message: string): never {
  throw new TypeOrmTenancyConfigurationError(`TypeORM tenancy ${message}.`);
}
