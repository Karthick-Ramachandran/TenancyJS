import type { TenancyManager, TenantRecord } from "tenancyjs-core";
import { assertSqlIdentifier } from "tenancyjs-adapter-shared";

import {
  PrismaTenancyConfigurationError,
  PrismaUnregisteredModelError,
} from "./errors.js";

const DEFAULT_TENANT_FIELD = "tenantId";

export interface PrismaTenantModelConfig {
  readonly tenantField?: string;
  readonly relationFields?: readonly string[];
}

export interface PrismaCentralModelConfig {
  readonly relationFields?: readonly string[];
}

export interface PrismaTenancyOptions<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly manager: TenancyManager<TTenant>;
  readonly tenantModels: Readonly<Record<string, PrismaTenantModelConfig>>;
  readonly centralModels?: Readonly<Record<string, PrismaCentralModelConfig>>;
}

export interface NormalizedPrismaTenantModelConfig {
  readonly tenantField: string;
  readonly relationFields: readonly string[];
}

export interface NormalizedPrismaCentralModelConfig {
  readonly relationFields: readonly string[];
}

export interface PrismaTenancyConfig<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly manager: TenancyManager<TTenant>;
  readonly tenantModels: Readonly<
    Record<string, Readonly<NormalizedPrismaTenantModelConfig>>
  >;
  readonly centralModels: Readonly<
    Record<string, Readonly<NormalizedPrismaCentralModelConfig>>
  >;
}

export type PrismaModelPolicy =
  | Readonly<{
      kind: "tenant";
      model: string;
      tenantField: string;
      relationFields: readonly string[];
    }>
  | Readonly<{
      kind: "central";
      model: string;
      relationFields: readonly string[];
    }>;

export function definePrismaTenancyConfig<
  TTenant extends TenantRecord = TenantRecord,
>(options: PrismaTenancyOptions<TTenant>): PrismaTenancyConfig<TTenant> {
  if (options === null || typeof options !== "object") {
    throw new PrismaTenancyConfigurationError(
      "Prisma tenancy options must be an object.",
    );
  }

  if (
    options.manager === null ||
    typeof options.manager !== "object" ||
    typeof options.manager.getContext !== "function"
  ) {
    throw new PrismaTenancyConfigurationError(
      "Prisma tenancy options require a TenancyManager.",
    );
  }

  if (
    options.tenantModels === null ||
    typeof options.tenantModels !== "object" ||
    Array.isArray(options.tenantModels)
  ) {
    throw new PrismaTenancyConfigurationError(
      "tenantModels must be a model-to-configuration object.",
    );
  }

  const tenantEntries = Object.entries(options.tenantModels);
  if (tenantEntries.length === 0) {
    throw new PrismaTenancyConfigurationError(
      "At least one tenant-scoped Prisma model is required.",
    );
  }

  const tenantModels: Record<string, NormalizedPrismaTenantModelConfig> = {};
  for (const [model, modelConfig] of tenantEntries) {
    assertIdentifier(model, "Prisma model");
    if (modelConfig === null || typeof modelConfig !== "object") {
      throw new PrismaTenancyConfigurationError(
        `Configuration for Prisma model "${model}" must be an object.`,
      );
    }

    const tenantField = modelConfig.tenantField ?? DEFAULT_TENANT_FIELD;
    assertIdentifier(tenantField, `Tenant field for Prisma model "${model}"`);
    const relationFields = normalizeRelationFields(
      model,
      tenantField,
      modelConfig.relationFields ?? [],
    );
    tenantModels[model] = Object.freeze({ tenantField, relationFields });
  }

  const centralModels = normalizeCentralModels(options.centralModels ?? {});
  for (const model of Object.keys(centralModels)) {
    if (Object.hasOwn(tenantModels, model)) {
      throw new PrismaTenancyConfigurationError(
        `Prisma model "${model}" cannot be both tenant-scoped and central.`,
      );
    }
  }

  return Object.freeze({
    manager: options.manager,
    tenantModels: Object.freeze(tenantModels),
    centralModels,
  });
}

export function classifyPrismaModel<
  TTenant extends TenantRecord = TenantRecord,
>(config: PrismaTenancyConfig<TTenant>, model: string): PrismaModelPolicy {
  const tenantModel = config.tenantModels[model];
  if (tenantModel !== undefined) {
    return Object.freeze({ kind: "tenant", model, ...tenantModel });
  }

  const centralModel = config.centralModels[model];
  if (centralModel !== undefined) {
    return Object.freeze({ kind: "central", model, ...centralModel });
  }

  throw new PrismaUnregisteredModelError(model);
}

function normalizeRelationFields(
  model: string,
  tenantField: string,
  relationFields: readonly string[],
): readonly string[] {
  if (!Array.isArray(relationFields)) {
    throw new PrismaTenancyConfigurationError(
      `relationFields for Prisma model "${model}" must be an array.`,
    );
  }

  const normalized = new Set<string>();
  for (const field of relationFields) {
    assertIdentifier(field, `Relation field for Prisma model "${model}"`);
    if (field === tenantField) {
      throw new PrismaTenancyConfigurationError(
        `Relation field "${field}" on Prisma model "${model}" conflicts with its tenant field.`,
      );
    }
    if (normalized.has(field)) {
      throw new PrismaTenancyConfigurationError(
        `Relation field "${field}" is repeated for Prisma model "${model}".`,
      );
    }
    normalized.add(field);
  }
  return Object.freeze([...normalized]);
}

function normalizeCentralModels(
  models: Readonly<Record<string, PrismaCentralModelConfig>>,
): Readonly<Record<string, Readonly<NormalizedPrismaCentralModelConfig>>> {
  if (models === null || typeof models !== "object" || Array.isArray(models)) {
    throw new PrismaTenancyConfigurationError(
      "centralModels must be a model-to-configuration object.",
    );
  }

  const normalized: Record<
    string,
    Readonly<NormalizedPrismaCentralModelConfig>
  > = {};
  for (const [model, modelConfig] of Object.entries(models)) {
    assertIdentifier(model, "Central Prisma model");
    if (modelConfig === null || typeof modelConfig !== "object") {
      throw new PrismaTenancyConfigurationError(
        `Configuration for central Prisma model "${model}" must be an object.`,
      );
    }
    normalized[model] = Object.freeze({
      relationFields: normalizeRelationFields(
        model,
        "__central_model_has_no_tenant_field__",
        modelConfig.relationFields ?? [],
      ),
    });
  }
  return Object.freeze(normalized);
}

function assertIdentifier(
  value: unknown,
  label: string,
): asserts value is string {
  assertSqlIdentifier(value, {
    label,
    allowLeadingUnderscore: false,
    createError: () =>
      new PrismaTenancyConfigurationError(
        `${label} must be a valid Prisma identifier.`,
      ),
  });
}
