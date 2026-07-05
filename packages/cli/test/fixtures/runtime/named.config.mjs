const RUNTIME_BRAND = Symbol.for("tenancyjs.runtime");

// No default export — the loader falls back to a named `runtime` export.
export const runtime = {
  [RUNTIME_BRAND]: true,
  manager: {
    runWithTenant: (_tenant, callback) => callback(),
    runAsCentral: (callback) => callback(),
    getContext: () => undefined,
  },
  adapters: [],
  async dispose() {},
};
