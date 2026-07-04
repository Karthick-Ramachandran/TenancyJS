import type { TenantRecord } from "@tenancyjs/core";
import { TenantContextError } from "@tenancyjs/core";
import { decideTenantDiscriminator } from "@tenancyjs/adapter-shared";

import {
  type PrismaTenancyConfig,
  type PrismaModelPolicy,
  classifyPrismaModel,
} from "./config.js";
import {
  PrismaTenancyConfigurationError,
  PrismaTenantFieldConflictError,
  PrismaUnsupportedOperationError,
} from "./errors.js";

const READ_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);
const CREATE_OPERATIONS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
]);
const UPDATE_OPERATIONS = new Set([
  "update",
  "updateMany",
  "updateManyAndReturn",
]);
const DELETE_OPERATIONS = new Set(["delete", "deleteMany"]);

export const PRISMA_SUPPORTED_OPERATIONS = Object.freeze([
  ...READ_OPERATIONS,
  ...CREATE_OPERATIONS,
  ...UPDATE_OPERATIONS,
  ...DELETE_OPERATIONS,
  "upsert",
]);

export function applyPrismaTenantPolicy<
  TTenant extends TenantRecord = TenantRecord,
>(
  config: PrismaTenancyConfig<TTenant>,
  model: string | undefined,
  operation: string,
  rawArgs: unknown,
): unknown {
  if (model === undefined) {
    throw new PrismaUnsupportedOperationError(operation);
  }

  const policy = classifyPrismaModel(config, model);
  if (!PRISMA_SUPPORTED_OPERATIONS.includes(operation)) {
    throw new PrismaUnsupportedOperationError(operation, model);
  }

  const args = normalizeArgs(rawArgs, model, operation);
  rejectRelationOperations(args, policy, operation);
  if (policy.kind === "central") {
    return rawArgs;
  }

  const context = config.manager.getContext();
  if (context === undefined) {
    throw new TenantContextError("missing");
  }
  if (context.mode === "central") {
    return rawArgs;
  }

  return transformTenantOperation(args, policy, operation, context.tenant.id);
}

function transformTenantOperation(
  args: Record<string, unknown>,
  policy: Extract<PrismaModelPolicy, { kind: "tenant" }>,
  operation: string,
  tenantId: string,
): Record<string, unknown> {
  if (READ_OPERATIONS.has(operation) || DELETE_OPERATIONS.has(operation)) {
    return withTenantWhere(args, policy.tenantField, tenantId);
  }

  if (CREATE_OPERATIONS.has(operation)) {
    return {
      ...args,
      data: withTenantCreateData(args.data, policy, operation, tenantId),
    };
  }

  if (UPDATE_OPERATIONS.has(operation)) {
    rejectTenantFieldUpdate(args.data, policy, operation, tenantId);
    return withTenantWhere(args, policy.tenantField, tenantId);
  }

  if (operation === "upsert") {
    rejectTenantFieldUpdate(args.update, policy, operation, tenantId);
    return {
      ...withTenantWhere(args, policy.tenantField, tenantId),
      create: withTenantCreateData(args.create, policy, operation, tenantId),
    };
  }

  throw new PrismaUnsupportedOperationError(operation, policy.model);
}

function withTenantWhere(
  args: Record<string, unknown>,
  tenantField: string,
  tenantId: string,
): Record<string, unknown> {
  const tenantWhere = { [tenantField]: tenantId };
  if (args.where === undefined) {
    return { ...args, where: tenantWhere };
  }

  const where = requireRecord(
    args.where,
    "Prisma where arguments must be objects.",
  );
  const existingAnd = where.AND;
  return {
    ...args,
    where: {
      ...where,
      AND:
        existingAnd === undefined ? [tenantWhere] : [existingAnd, tenantWhere],
    },
  };
}

function withTenantCreateData(
  rawData: unknown,
  policy: Extract<PrismaModelPolicy, { kind: "tenant" }>,
  operation: string,
  tenantId: string,
): Record<string, unknown> | readonly Record<string, unknown>[] {
  if (Array.isArray(rawData)) {
    return rawData.map((entry) =>
      withTenantCreateEntry(entry, policy, operation, tenantId),
    );
  }
  return withTenantCreateEntry(rawData, policy, operation, tenantId);
}

function withTenantCreateEntry(
  rawEntry: unknown,
  policy: Extract<PrismaModelPolicy, { kind: "tenant" }>,
  operation: string,
  tenantId: string,
): Record<string, unknown> {
  const entry = requireRecord(
    rawEntry,
    `Prisma ${policy.model}.${operation} requires object data.`,
  );
  const suppliedTenant = entry[policy.tenantField];
  const decision = decideTenantDiscriminator(
    tenantId,
    "create",
    Object.hasOwn(entry, policy.tenantField),
    suppliedTenant,
  );
  if (decision.kind === "reject") {
    throw new PrismaTenantFieldConflictError(policy.model, operation);
  }
  return decision.kind === "inject"
    ? { ...entry, [policy.tenantField]: decision.value }
    : entry;
}

function rejectTenantFieldUpdate(
  rawData: unknown,
  policy: Extract<PrismaModelPolicy, { kind: "tenant" }>,
  operation: string,
  tenantId: string,
): void {
  const data = requireRecord(
    rawData,
    `Prisma ${policy.model}.${operation} requires object data.`,
  );
  if (
    decideTenantDiscriminator(
      tenantId,
      "update",
      Object.hasOwn(data, policy.tenantField),
      data[policy.tenantField],
    ).kind === "reject"
  ) {
    throw new PrismaTenantFieldConflictError(policy.model, operation);
  }
}

function rejectRelationOperations(
  args: Record<string, unknown>,
  policy: PrismaModelPolicy,
  operation: string,
): void {
  if (
    policy.relationFields.length > 0 &&
    containsKey(args, policy.relationFields)
  ) {
    throw new PrismaUnsupportedOperationError(
      operation,
      policy.model,
      "relation",
    );
  }
}

function containsKey(value: unknown, rejectedKeys: readonly string[]): boolean {
  if (Array.isArray(value)) {
    return value.some((entry) => containsKey(entry, rejectedKeys));
  }
  if (!isRecord(value)) {
    return false;
  }

  for (const [key, child] of Object.entries(value)) {
    if (rejectedKeys.includes(key) || containsKey(child, rejectedKeys)) {
      return true;
    }
  }
  return false;
}

function normalizeArgs(
  rawArgs: unknown,
  model: string,
  operation: string,
): Record<string, unknown> {
  if (rawArgs === undefined) {
    return {};
  }
  return requireRecord(
    rawArgs,
    `Prisma ${model}.${operation} requires object arguments.`,
  );
}

function requireRecord(
  value: unknown,
  message: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new PrismaTenancyConfigurationError(message);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
