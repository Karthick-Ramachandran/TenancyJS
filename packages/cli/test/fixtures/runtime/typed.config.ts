const RUNTIME_BRAND = Symbol.for("tenancyjs.runtime");

// Type annotations here must be stripped natively by Node 24 for this config to
// load through the CLI with no transpiler dependency (ADR-0027).
interface FixtureTenant {
  readonly id: string;
}

const tenants: readonly FixtureTenant[] = [{ id: "typed-alpha" }];

export default {
  [RUNTIME_BRAND]: true,
  manager: {
    runWithTenant: (_tenant: FixtureTenant, callback: () => unknown) =>
      callback(),
    runAsCentral: (callback: () => unknown) => callback(),
    getContext: (): unknown => undefined,
  },
  store: {
    list: async (): Promise<readonly FixtureTenant[]> => tenants,
  },
  adapters: [],
  async dispose(): Promise<void> {},
};
