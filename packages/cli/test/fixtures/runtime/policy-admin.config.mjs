import { writeFileSync } from "node:fs";
import process from "node:process";

const RUNTIME_BRAND = Symbol.for("tenancyjs.runtime");

// A branded runtime whose admin connection records the DDL it is asked to run
// (to POLICY_APPLY_OUT) so a test can assert exactly what `policy --apply` applied.
export default {
  [RUNTIME_BRAND]: true,
  manager: {
    runWithTenant: (_tenant, callback) => callback(),
    runInCentralContext: (callback) => callback(),
    getContext: () => undefined,
  },
  adapters: [],
  admin: {
    query: async (sql) => {
      if (process.env.POLICY_APPLY_OUT)
        writeFileSync(process.env.POLICY_APPLY_OUT, sql);
      return { rows: [] };
    },
  },
  async dispose() {},
};
