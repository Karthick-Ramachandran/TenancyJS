const RUNTIME_BRAND = Symbol.for("tenancyjs.runtime");

export default {
  [RUNTIME_BRAND]: true,
  manager: {
    runWithTenant: (_tenant, callback) => callback(),
    runAsCentral: (callback) => callback(),
    getContext: () => undefined,
  },
  store: {
    list: async () => [{ id: "alpha" }, { id: "beta" }],
  },
  adapters: [],
  async dispose() {},
};
