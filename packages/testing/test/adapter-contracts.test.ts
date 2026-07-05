import { TenancyManager } from "tenancyjs-core";
import { describe, expect, it } from "vitest";

import {
  TenancyContractAssertionError,
  createRowLevelAdapterContract,
} from "../src/index.js";
import type {
  RowLevelAdapterContractHarness,
  RowLevelAdapterContractOperations,
  RowLevelAdapterContractRecord,
} from "../src/index.js";

function createMemoryHarness(
  leakyReads = false,
): RowLevelAdapterContractHarness {
  const manager = new TenancyManager();
  let records: RowLevelAdapterContractRecord[] = [];

  function operations(
    getRecords: () => RowLevelAdapterContractRecord[],
    setRecords: (next: RowLevelAdapterContractRecord[]) => void,
  ): RowLevelAdapterContractOperations {
    return {
      async create(input) {
        const tenantId = manager.getTenantOrFail().id;
        if (input.tenantId !== undefined && input.tenantId !== tenantId) {
          throw new Error("tenant conflict");
        }
        const record = { ...input, tenantId };
        setRecords([...getRecords(), record]);
        return record;
      },
      async findMany() {
        const context = manager.getContext();
        if (context === undefined) manager.getTenantOrFail();
        if (context?.mode === "central" || leakyReads) return [...getRecords()];
        return getRecords().filter(
          (record) => record.tenantId === context?.tenant.id,
        );
      },
      async count() {
        return (await this.findMany()).length;
      },
      async updateMany(value) {
        const tenantId = manager.getTenantOrFail().id;
        let affected = 0;
        setRecords(
          getRecords().map((record) => {
            if (record.tenantId !== tenantId) return record;
            affected += 1;
            return { ...record, value };
          }),
        );
        return affected;
      },
      async deleteMany() {
        const tenantId = manager.getTenantOrFail().id;
        const before = getRecords().length;
        setRecords(
          getRecords().filter((record) => record.tenantId !== tenantId),
        );
        return before - getRecords().length;
      },
    };
  }

  const rootOperations = operations(
    () => records,
    (next) => {
      records = next;
    },
  );

  return {
    ...rootOperations,
    async reset() {
      records = [];
    },
    async seed(next) {
      records = next.map((record) => ({ ...record }));
    },
    runWithTenant(tenantId, callback) {
      return manager.runWithTenant({ id: tenantId }, callback);
    },
    runInCentralContext(callback) {
      return manager.runInCentralContext(callback);
    },
    async transaction(callback) {
      let transactionRecords = records.map((record) => ({ ...record }));
      const transactionOperations = operations(
        () => transactionRecords,
        (next) => {
          transactionRecords = next;
        },
      );
      const result = await callback(transactionOperations);
      records = transactionRecords;
      return result;
    },
  };
}

describe("row-level adapter contract", () => {
  it("passes for an isolated implementation", async () => {
    for (const contractCase of createRowLevelAdapterContract(() =>
      createMemoryHarness(),
    )) {
      await contractCase.run();
    }
  });

  it("detects a cross-tenant read leak", async () => {
    const readCase = createRowLevelAdapterContract(() =>
      createMemoryHarness(true),
    )[0];

    await expect(readCase?.run()).rejects.toBeInstanceOf(
      TenancyContractAssertionError,
    );
  });
});
