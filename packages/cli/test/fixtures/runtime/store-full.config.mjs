const RUNTIME_BRAND = Symbol.for("tenancyjs.runtime");

const TENANTS = [
  {
    id: "acme",
    status: "active",
    slug: "acme-inc",
    // A placement holding a secret — output must redact it.
    placement: { url: "postgres://admin:s3cr3t@db.internal:5432/acme" },
  },
  { id: "globex", status: "suspended", regions: ["us", "eu"] },
];

export default {
  [RUNTIME_BRAND]: true,
  manager: {
    runWithTenant: (_tenant, callback) => callback(),
    runInCentralContext: (callback) => callback(),
    getContext: () => undefined,
  },
  store: {
    list: async () => TENANTS,
    find: async (id) => TENANTS.find((tenant) => tenant.id === id) ?? null,
  },
  adapters: [],
  async dispose() {},
};
