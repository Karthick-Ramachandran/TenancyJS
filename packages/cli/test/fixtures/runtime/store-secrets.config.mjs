const RUNTIME_BRAND = Symbol.for("tenancyjs.runtime");

// A tenant carrying secrets as BARE fields (not inside a connection URL), which
// a regex over serialised JSON cannot catch — exercises structural redaction.
const TENANT = {
  id: "acme",
  plan: "pro",
  password: "hunter2",
  token: "tok_live_abc123",
  apiKey: "key_xyz789",
  databaseUrl: "postgres://u:p@host/db",
};

export default {
  [RUNTIME_BRAND]: true,
  manager: {
    runWithTenant: (_tenant, callback) => callback(),
    runInCentralContext: (callback) => callback(),
    getContext: () => undefined,
  },
  store: {
    list: async () => [TENANT],
    find: async (id) => (id === TENANT.id ? TENANT : null),
  },
  adapters: [],
  async dispose() {},
};
