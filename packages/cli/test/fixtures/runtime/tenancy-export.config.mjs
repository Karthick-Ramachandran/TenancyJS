const RUNTIME_BRAND = Symbol.for("tenancyjs.runtime");

// No default/`runtime` export — the loader falls back to a named `tenancy`.
export const tenancy = {
  [RUNTIME_BRAND]: true,
  manager: {
    runWithTenant: (_tenant, callback) => callback(),
    runAsCentral: (callback) => callback(),
    getContext: () => undefined,
  },
  adapters: [],
  async dispose() {},
};
