export { defineConfig } from "./config.js";
export type {
  TenancyAdapter,
  TenancyAdapterCapabilities,
  TenancyAdapterCapabilityStatus,
  TenancyAdapterValidationIssue,
  TenancyAdapterValidationResult,
  TenancyAdapterValidationSeverity,
} from "./adapter.js";
export {
  DuplicateBootstrapperError,
  InvalidBootstrapperError,
  InvalidTenantError,
  TenancyError,
  TenancyLifecycleError,
  TenantContextError,
} from "./errors.js";
export { TenancyManager } from "./tenancy-manager.js";
export type {
  CentralContext,
  MaybePromise,
  TenancyBootstrapper,
  TenancyConfig,
  TenancyLifecycleEventName,
  TenancyLifecycleListener,
  TenancyManagerOptions,
  TenancyStrategy,
  TenantContext,
  TenantExecutionContext,
  TenantRecord,
} from "./types.js";
export type { TenancyErrorCode, TenantContextErrorReason } from "./errors.js";
