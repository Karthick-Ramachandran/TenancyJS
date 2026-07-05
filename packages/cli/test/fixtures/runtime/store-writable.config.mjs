const RUNTIME_BRAND = Symbol.for("tenancyjs.runtime");

// A tiny in-memory store so mutation commands have somewhere to write. State is
// module-scoped, so each fresh import (per command invocation) starts clean.
const tenants = new Map([["seed", { id: "seed", status: "active" }]]);
let generated = 0;

export default {
  [RUNTIME_BRAND]: true,
  manager: {
    runWithTenant: (_tenant, callback) => callback(),
    runInCentralContext: (callback) => callback(),
    getContext: () => undefined,
  },
  store: {
    list: async () => [...tenants.values()],
    find: async (id) => tenants.get(id) ?? null,
    create: async (input) => {
      const id = input.id ?? `generated-${(generated += 1)}`;
      const tenant = { ...input, id, status: "active" };
      tenants.set(id, tenant);
      return tenant;
    },
    suspend: async (id) => {
      const tenant = {
        ...(tenants.get(id) ?? { id }),
        id,
        status: "suspended",
      };
      tenants.set(id, tenant);
      return tenant;
    },
    activate: async (id) => {
      const tenant = { ...(tenants.get(id) ?? { id }), id, status: "active" };
      tenants.set(id, tenant);
      return tenant;
    },
  },
  adapters: [],
  async dispose() {},
};
