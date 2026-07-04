import type { TenancyConfig } from "./types.js";

const STRATEGIES = new Set([
  "rowLevel",
  "schemaPerTenant",
  "databasePerTenant",
]);

export function defineConfig<const TConfig extends TenancyConfig>(
  config: TConfig,
): Readonly<TConfig> {
  if (
    config === null ||
    typeof config !== "object" ||
    !STRATEGIES.has(config.strategy)
  ) {
    throw new TypeError(
      'Tenancy strategy must be "rowLevel", "schemaPerTenant", or "databasePerTenant".',
    );
  }

  return Object.freeze({ ...config });
}
