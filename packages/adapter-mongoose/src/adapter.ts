import type {
  MaybePromise,
  TenancyAdapter,
  TenancyAdapterValidationResult,
  TenantContext,
  TenantRecord,
} from "@tenancyjs/core";
import { TenantContextError } from "@tenancyjs/core";
import { decideTenantDiscriminator } from "@tenancyjs/adapter-shared";
import { Types, type ClientSession, type Model } from "mongoose";

import { MONGOOSE_ADAPTER_CAPABILITIES } from "./capabilities.js";
import {
  defineMongooseTenancyConfig,
  type MongooseModelPolicy,
  type MongooseTenancyConfig,
  type MongooseTenancyOptions,
} from "./config.js";
import {
  MongooseModelUnregisteredError,
  MongooseTenantFieldConflictError,
  MongooseTenancyConfigurationError,
  MongooseUnsafeFilterError,
  MongooseValidationError,
} from "./errors.js";
import type {
  MongooseFilter,
  MongooseValues,
  ProtectedMongooseClient,
  ProtectedMongooseModel,
} from "./types.js";

export interface MongooseTenancyAdapter<
  TTenant extends TenantRecord = TenantRecord,
> extends TenancyAdapter {
  readonly name: "mongoose";
  readonly strategy: "rowLevel";
  readonly config: MongooseTenancyConfig<TTenant>;
  run<TResult>(
    callback: (client: ProtectedMongooseClient) => MaybePromise<TResult>,
  ): Promise<TResult>;
  close(): Promise<void>;
}

export function createMongooseTenancy<
  TTenant extends TenantRecord = TenantRecord,
>(options: MongooseTenancyOptions<TTenant>): MongooseTenancyAdapter<TTenant> {
  const config = defineMongooseTenancyConfig(options);
  let validated = false;

  async function validate(): Promise<TenancyAdapterValidationResult> {
    const replicaSet = await detectReplicaSet(config);
    validated = replicaSet;
    return Object.freeze({
      valid: replicaSet,
      issues: Object.freeze([
        ...(replicaSet
          ? []
          : [
              Object.freeze({
                code: "TENANCY_MONGOOSE_REPLICA_SET_REQUIRED",
                severity: "error" as const,
                message:
                  "Mongoose tenancy requires a reachable MongoDB replica set for managed transactions.",
              }),
            ]),
        Object.freeze({
          code: "TENANCY_MONGOOSE_ADAPTER_ENFORCED",
          severity: "warning" as const,
          message:
            "SECURITY BOUNDARY: MongoDB has no row-level security, so Mongoose tenant isolation is enforced ONLY by this adapter's facade. Any use of the native model, collection, or connection bypasses isolation entirely — never expose them outside this adapter.",
        }),
      ]),
    });
  }

  async function run<TResult>(
    callback: (client: ProtectedMongooseClient) => MaybePromise<TResult>,
  ): Promise<TResult> {
    if (!validated) throw new MongooseValidationError();
    if (typeof callback !== "function") {
      throw new MongooseTenancyConfigurationError(
        "Mongoose protected execution requires a callback.",
      );
    }
    const context = config.manager.getContext();
    if (context === undefined) throw new TenantContextError("missing");
    return config.connection.transaction(async (session) =>
      callback(createProtectedClient(config, session, context)),
    );
  }

  return Object.freeze({
    name: "mongoose" as const,
    strategy: "rowLevel" as const,
    capabilities: MONGOOSE_ADAPTER_CAPABILITIES,
    config,
    validate,
    run,
    async close() {},
  });
}

async function detectReplicaSet(
  config: Pick<MongooseTenancyConfig, "connection">,
): Promise<boolean> {
  try {
    const hello = await config.connection.db?.admin().command({ hello: 1 });
    return typeof hello?.setName === "string";
  } catch {
    return false;
  }
}

function createProtectedClient<TTenant extends TenantRecord>(
  config: MongooseTenancyConfig<TTenant>,
  session: ClientSession,
  context: TenantContext<TTenant>,
): ProtectedMongooseClient {
  return Object.freeze({
    model(model: Model<unknown>) {
      const policy = config.classify(model);
      if (policy === undefined) throw new MongooseModelUnregisteredError();
      return createProtectedModel(model, policy, session, context);
    },
  });
}

function createProtectedModel(
  model: Model<unknown>,
  policy: MongooseModelPolicy,
  session: ClientSession,
  context: TenantContext,
): ProtectedMongooseModel {
  const native = model as Model<Record<string, unknown>>;
  const tenantField = policy.kind === "tenant" ? policy.tenantField : undefined;
  return Object.freeze({
    async find(filter: MongooseFilter = {}) {
      const rows = await native
        .find(scopedFilter(filter, tenantField, context))
        .session(session)
        .lean()
        .exec();
      return Object.freeze(rows.map(toPlain));
    },
    async findOne(filter: MongooseFilter) {
      const row = await native
        .findOne(scopedFilter(filter, tenantField, context))
        .session(session)
        .lean()
        .exec();
      return row === null ? null : toPlain(row);
    },
    count(filter: MongooseFilter = {}) {
      return native
        .countDocuments(scopedFilter(filter, tenantField, context))
        .session(session)
        .exec();
    },
    async create(values: MongooseValues) {
      await native.insertMany(
        [scopedValues(values, tenantField, context, "create")],
        {
          session,
        },
      );
    },
    async createMany(values: readonly MongooseValues[]) {
      if (!Array.isArray(values) || values.length === 0)
        throw new MongooseUnsafeFilterError();
      await native.insertMany(
        values.map((value) =>
          scopedValues(value, tenantField, context, "create"),
        ),
        { session },
      );
    },
    async update(filter: MongooseFilter, values: MongooseValues) {
      const result = await native.updateMany(
        scopedFilter(filter, tenantField, context),
        { $set: scopedValues(values, tenantField, context, "update") },
        { session, runValidators: true },
      );
      return result.modifiedCount;
    },
    async delete(filter: MongooseFilter) {
      const result = await native.deleteMany(
        scopedFilter(filter, tenantField, context),
        {
          session,
        },
      );
      return result.deletedCount;
    },
  });
}

function scopedFilter(
  filter: MongooseFilter,
  tenantField: string | undefined,
  context: TenantContext,
): Record<string, unknown> {
  assertPlainFilter(filter);
  const result: Record<string, unknown> = { ...filter };
  if (tenantField !== undefined && context.mode === "tenant") {
    if (
      Object.hasOwn(result, tenantField) &&
      result[tenantField] !== context.tenant.id
    ) {
      throw new MongooseTenantFieldConflictError("filter");
    }
    result[tenantField] = context.tenant.id;
  }
  return result;
}

function scopedValues(
  values: MongooseValues,
  tenantField: string | undefined,
  context: TenantContext,
  operation: "create" | "update",
): Record<string, unknown> {
  assertPlainRecord(values);
  assertSafeKeys(values);
  const result: Record<string, unknown> = { ...values };
  if (tenantField === undefined) return result;
  const decision = decideTenantDiscriminator(
    context.mode === "tenant" ? context.tenant.id : undefined,
    operation,
    Object.hasOwn(result, tenantField),
    result[tenantField],
  );
  if (decision.kind === "reject")
    throw new MongooseTenantFieldConflictError(operation);
  if (decision.kind === "inject") result[tenantField] = decision.value;
  return result;
}

function assertPlainFilter(value: unknown): asserts value is MongooseFilter {
  assertPlainRecord(value);
  assertSafeKeys(value);
  for (const entry of Object.values(value)) {
    if (
      entry !== null &&
      typeof entry !== "string" &&
      typeof entry !== "number" &&
      typeof entry !== "boolean" &&
      !(entry instanceof Date) &&
      !(entry instanceof Types.ObjectId)
    ) {
      throw new MongooseUnsafeFilterError();
    }
  }
}

function assertPlainRecord(
  value: unknown,
): asserts value is Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    throw new MongooseUnsafeFilterError();
  }
}

function assertSafeKeys(value: Record<string, unknown>): void {
  if (
    Object.keys(value).some((key) => key.startsWith("$") || key.includes("."))
  ) {
    throw new MongooseUnsafeFilterError();
  }
}

function toPlain(
  value: Record<string, unknown>,
): Readonly<Record<string, unknown>> {
  return Object.freeze({ ...value });
}
