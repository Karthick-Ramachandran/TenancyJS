const RUNTIME_BRAND = Symbol.for("tenancyjs.runtime");

// A store whose list() throws — `tenant check` must report a failure (exit 2).
export default {
  [RUNTIME_BRAND]: true,
  manager: {
    runWithTenant: (_tenant, callback) => callback(),
    runInCentralContext: (callback) => callback(),
    getContext: () => undefined,
  },
  store: {
    list: async () => {
      throw new Error("could not reach postgres://user:secret@db:5432/app");
    },
  },
  adapters: [],
  async dispose() {},
};
