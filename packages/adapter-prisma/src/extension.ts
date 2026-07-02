import type { TenantRecord } from "@tenancyjs/core";

import {
  type PrismaTenancyConfig,
  type PrismaTenancyOptions,
  definePrismaTenancyConfig,
} from "./config.js";
import { applyPrismaTenantPolicy } from "./operation-policy.js";

export interface PrismaQueryExtensionParameters {
  readonly model?: string;
  readonly operation: string;
  readonly args: unknown;
  readonly query: (args: unknown) => Promise<unknown>;
}

export interface PrismaTenancyExtension {
  readonly name: "tenancyjs-row-level";
  readonly query: Readonly<{
    $allOperations(
      parameters: PrismaQueryExtensionParameters,
    ): Promise<unknown>;
  }>;
}

export function createPrismaTenancyExtension<
  TTenant extends TenantRecord = TenantRecord,
>(options: PrismaTenancyOptions<TTenant>): PrismaTenancyExtension {
  return createExtensionFromConfig(definePrismaTenancyConfig(options));
}

export function createExtensionFromConfig<
  TTenant extends TenantRecord = TenantRecord,
>(config: PrismaTenancyConfig<TTenant>): PrismaTenancyExtension {
  const query = Object.freeze({
    async $allOperations({
      model,
      operation,
      args,
      query: execute,
    }: PrismaQueryExtensionParameters): Promise<unknown> {
      const scopedArgs = applyPrismaTenantPolicy(
        config,
        model,
        operation,
        args,
      );
      return execute(scopedArgs);
    },
  });

  return Object.freeze({ name: "tenancyjs-row-level", query });
}
