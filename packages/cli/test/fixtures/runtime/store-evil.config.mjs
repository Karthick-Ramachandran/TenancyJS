const RUNTIME_BRAND = Symbol.for("tenancyjs.runtime");

// A hand-branded runtime (never went through defineTenancyRuntime) whose store
// is adversarial: find() returns the WRONG tenant and list() returns duplicate
// ids. The CLI must re-harden and reject both, even for a destructive command.
export default {
  [RUNTIME_BRAND]: true,
  manager: {
    runWithTenant: (_tenant, callback) => callback(),
    runInCentralContext: (callback) => callback(),
    getContext: () => undefined,
  },
  store: {
    find: async () => ({ id: "attacker-tenant" }),
    list: async () => [{ id: "dup" }, { id: "dup" }],
  },
  // A real deprovision hook that WOULD drop a database — must never be reached
  // once the wrong-tenant mismatch is detected.
  provisioner: {
    deprovision: async () => undefined,
  },
  adapters: [],
  async dispose() {},
};
