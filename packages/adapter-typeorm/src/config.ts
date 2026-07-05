import type { TenancyManager, TenantRecord } from "tenancyjs-core";
import { normalizeQualifiedTable } from "tenancyjs-adapter-shared";
import type { DataSource, EntityTarget, ObjectLiteral } from "typeorm";

import { TypeOrmTenancyConfigurationError } from "./errors.js";
import type {
  TypeOrmCentralEntityConfig,
  TypeOrmTenantEntityConfig,
} from "./types.js";

export interface TypeOrmTenancyOptions<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly manager: TenancyManager<TTenant>;
  readonly dataSource: DataSource;
  readonly tenantEntities: readonly TypeOrmTenantEntityConfig[];
  readonly centralEntities?: readonly TypeOrmCentralEntityConfig[];
}

export interface NormalizedTypeOrmTenantEntityConfig {
  readonly entity: EntityTarget<ObjectLiteral>;
  readonly schema: string;
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
        defaultSchema: "public",
        allowQualified: true,
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
      schema: table.schema!,
      table: table.table,
      qualifiedName: table.qualifiedName,
      tenantProperty,
      tenantColumn,
      policyName,
    });
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
    tenantEntities: Object.freeze(tenantEntities),
    classify: (entity: EntityTarget<ObjectLiteral>) => policies.get(entity),
  });
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
