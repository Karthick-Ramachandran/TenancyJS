import type {
  TenancyAdapter,
  TenancyAdapterValidationResult,
  TenantRecord,
} from "tenancyjs-core";

import { PRISMA_ADAPTER_CAPABILITIES } from "./capabilities.js";
import {
  type PrismaTenancyConfig,
  type PrismaTenancyOptions,
  definePrismaTenancyConfig,
} from "./config.js";
import {
  type PrismaTenancyExtension,
  createExtensionFromConfig,
} from "./extension.js";

const VALID_RESULT: TenancyAdapterValidationResult = Object.freeze({
  valid: true,
  issues: Object.freeze([
    Object.freeze({
      code: "TENANCY_PRISMA_SCHEMA_CLASSIFICATION_UNVERIFIED",
      severity: "warning" as const,
      message:
        "Verify configured tenant, central, discriminator, and relation fields against the generated Prisma schema.",
    }),
  ]),
});

export interface PrismaTenancyAdapter<
  TTenant extends TenantRecord = TenantRecord,
> extends TenancyAdapter {
  readonly name: "prisma";
  readonly strategy: "rowLevel";
  readonly config: PrismaTenancyConfig<TTenant>;
  readonly extension: PrismaTenancyExtension;
}

export function createPrismaAdapter<
  TTenant extends TenantRecord = TenantRecord,
>(options: PrismaTenancyOptions<TTenant>): PrismaTenancyAdapter<TTenant> {
  const config = definePrismaTenancyConfig(options);
  return Object.freeze({
    name: "prisma",
    strategy: "rowLevel",
    capabilities: PRISMA_ADAPTER_CAPABILITIES,
    config,
    extension: createExtensionFromConfig(config),
    validate: () => VALID_RESULT,
  });
}
