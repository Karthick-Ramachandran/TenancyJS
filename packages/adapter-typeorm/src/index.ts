export { createTypeOrmTenancy } from "./adapter.js";
export type { TypeOrmTenancyAdapter } from "./adapter.js";
export { TYPEORM_ADAPTER_CAPABILITIES } from "./capabilities.js";
export { defineTypeOrmTenancyConfig } from "./config.js";
export type {
  NormalizedTypeOrmTenantEntityConfig,
  TypeOrmEntityPolicy,
  TypeOrmTenancyConfig,
  TypeOrmTenancyOptions,
} from "./config.js";
export {
  TypeOrmEntityUnregisteredError,
  TypeOrmPolicyValidationError,
  TypeOrmTenantFieldConflictError,
  TypeOrmTenancyConfigurationError,
  TypeOrmTenancyError,
  TypeOrmUnsafeCriteriaError,
} from "./errors.js";
export type { TypeOrmTenancyErrorCode } from "./errors.js";
export type {
  ProtectedTypeOrmClient,
  ProtectedTypeOrmRepository,
  TypeOrmCentralEntityConfig,
  TypeOrmCriteria,
  TypeOrmDatabasePlacement,
  TypeOrmScalar,
  TypeOrmTenantEntityConfig,
  TypeOrmValues,
} from "./types.js";
