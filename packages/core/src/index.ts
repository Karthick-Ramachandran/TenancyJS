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
  InvalidTenancyRuntimeError,
  InvalidTenantError,
  TenancyError,
  TenancyLifecycleError,
  TenantContextError,
  TenantStoreContractError,
} from "./errors.js";
export { TenancyManager } from "./tenancy-manager.js";
export {
  defineTenancyRuntime,
  assertTenancyRuntime,
  type TenancyProvisioner,
  type TenancyRuntime,
  type TenancyRuntimeInput,
} from "./runtime.js";
export {
  hardenTenantStore,
  requireStoreMethod,
  type TenantStore,
  type TenantStoreCreateInput,
} from "./tenant-store.js";
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
