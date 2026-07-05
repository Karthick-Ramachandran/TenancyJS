// A plausible-looking object that was NOT built with defineTenancyRuntime, so
// it carries no brand and must be rejected.
export default {
  manager: {},
  adapters: [],
  async dispose() {},
};
