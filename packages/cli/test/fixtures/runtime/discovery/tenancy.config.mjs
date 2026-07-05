const RUNTIME_BRAND = Symbol.for("tenancyjs.runtime");

// Placed at the default discovery name so the loader finds it with no --config.
export default {
  [RUNTIME_BRAND]: true,
  manager: {
    runWithTenant: (_tenant, callback) => callback(),
    runAsCentral: (callback) => callback(),
    getContext: () => undefined,
  },
  store: {
    list: async () => [{ id: "found" }],
  },
  adapters: [],
  async dispose() {},
};
