export { createKnexTenancy } from "./adapter.js";
export type { KnexTenancyAdapter } from "./adapter.js";
export { KNEX_ADAPTER_CAPABILITIES } from "./capabilities.js";
export {
  KNEX_CENTRAL_SETTING,
  KNEX_TENANT_SETTING,
  classifyKnexTable,
  defineKnexTenancyConfig,
} from "./config.js";
export type {
  KnexCentralTableConfig,
  KnexDatabasePlacement,
  KnexTablePolicy,
  KnexTenantTableConfig,
  KnexTenancyConfig,
  KnexTenancyOptions,
  NormalizedKnexCentralTableConfig,
  NormalizedKnexTenantTableConfig,
} from "./config.js";
export {
  KnexPolicyValidationError,
  KnexTenantFieldConflictError,
  KnexTenancyConfigurationError,
  KnexTenancyError,
  KnexUnregisteredTableError,
  KnexUnsupportedOperationError,
} from "./errors.js";
export type { KnexTenancyErrorCode } from "./errors.js";
export type {
  KnexDataRecord,
  KnexSafeScalar,
  ProtectedKnexClient,
  ProtectedKnexQuery,
} from "./types.js";
