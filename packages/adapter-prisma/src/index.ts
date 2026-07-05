export { PRISMA_ADAPTER_CAPABILITIES } from "./capabilities.js";
export { createPrismaAdapter } from "./adapter.js";
export { createPrismaDatabaseTenancy } from "./database-router.js";
export type {
  PrismaDatabasePlacement,
  PrismaDatabaseTenancy,
  PrismaDatabaseTenancyOptions,
} from "./database-router.js";
export { classifyPrismaModel, definePrismaTenancyConfig } from "./config.js";
export {
  PrismaTenancyConfigurationError,
  PrismaTenancyError,
  PrismaTenantFieldConflictError,
  PrismaUnregisteredModelError,
  PrismaUnsupportedOperationError,
} from "./errors.js";
export {
  createExtensionFromConfig,
  createPrismaTenancyExtension,
} from "./extension.js";
export {
  PRISMA_SUPPORTED_OPERATIONS,
  applyPrismaTenantPolicy,
} from "./operation-policy.js";
export type { PrismaTenancyAdapter } from "./adapter.js";
export type {
  NormalizedPrismaCentralModelConfig,
  NormalizedPrismaTenantModelConfig,
  PrismaCentralModelConfig,
  PrismaModelPolicy,
  PrismaTenancyConfig,
  PrismaTenancyOptions,
  PrismaTenantModelConfig,
} from "./config.js";
export type {
  PrismaTenancyErrorCode,
  PrismaUnsupportedOperationReason,
} from "./errors.js";
export type {
  PrismaQueryExtensionParameters,
  PrismaTenancyExtension,
} from "./extension.js";
