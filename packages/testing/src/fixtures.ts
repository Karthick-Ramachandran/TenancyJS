import type { TenantFixture } from "./types.js";

const DEFAULT_TENANT: TenantFixture = Object.freeze({
  id: "tenant-a",
  name: "Tenant A",
  status: "active",
  strategy: "rowLevel",
});

export function createTenantFixture<
  const TOverrides extends Partial<TenantFixture> = Record<never, never>,
>(overrides?: TOverrides): Readonly<TenantFixture & TOverrides> {
  return Object.freeze({
    ...DEFAULT_TENANT,
    ...overrides,
  }) as Readonly<TenantFixture & TOverrides>;
}
