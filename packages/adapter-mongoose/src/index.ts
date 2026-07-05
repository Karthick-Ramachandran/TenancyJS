export { createMongooseTenancy } from "./adapter.js";
export type { MongooseTenancyAdapter } from "./adapter.js";
export { MONGOOSE_ADAPTER_CAPABILITIES } from "./capabilities.js";
export { defineMongooseTenancyConfig } from "./config.js";
export type {
  MongooseModelPolicy,
  MongooseTenancyConfig,
  MongooseTenancyOptions,
} from "./config.js";
export {
  MongooseModelUnregisteredError,
  MongooseTenantFieldConflictError,
  MongooseTenancyConfigurationError,
  MongooseTenancyError,
  MongooseUnsafeFilterError,
  MongooseValidationError,
} from "./errors.js";
export type { MongooseTenancyErrorCode } from "./errors.js";
export type {
  MongooseCentralModelConfig,
  MongooseFilter,
  MongooseScalar,
  MongooseTenantModelConfig,
  MongooseValues,
  ProtectedMongooseClient,
  ProtectedMongooseModel,
} from "./types.js";
