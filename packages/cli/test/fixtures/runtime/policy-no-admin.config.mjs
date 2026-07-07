const RUNTIME_BRAND = Symbol.for("tenancyjs.runtime");

export default {
  [RUNTIME_BRAND]: true,
  manager: {
    runWithTenant: (_tenant, callback) => callback(),
    runInCentralContext: (callback) => callback(),
    getContext: () => undefined,
  },
  adapters: [],
  async dispose() {},
};
