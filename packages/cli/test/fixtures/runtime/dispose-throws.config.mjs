const RUNTIME_BRAND = Symbol.for("tenancyjs.runtime");

// The command succeeds but disposal fails — the loader/engine must surface it.
export default {
  [RUNTIME_BRAND]: true,
  manager: {
    runWithTenant: (_tenant, callback) => callback(),
    runAsCentral: (callback) => callback(),
    getContext: () => undefined,
  },
  adapters: [],
  async dispose() {
    throw new Error("dispose failed closing connections");
  },
};
