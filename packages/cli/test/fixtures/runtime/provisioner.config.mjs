const RUNTIME_BRAND = Symbol.for("tenancyjs.runtime");

const TENANTS = [
  { id: "seed", placement: { schema: "tenant_seed" } },
  { id: "broken", placement: { schema: "tenant_broken" } },
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
  // A provisioner that succeeds for every tenant except "broken", whose
  // migrate() throws — so a partial `--all` run is observable.
  provisioner: {
    provision: async () => undefined,
    deprovision: async () => undefined,
    migrate: async (tenant) => {
      if (tenant.id === "broken") {
        throw new Error("migration failed for postgres://u:secret@db/broken");
      }
    },
  },
  adapters: [],
  async dispose() {},
};
