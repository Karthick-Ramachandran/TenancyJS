import { assertContract } from "./assertion.js";
import type {
  RowLevelAdapterContractHarnessFactory,
  RowLevelAdapterContractRecord,
  TenancyContractCase,
} from "./types.js";

const SEEDED_RECORDS: readonly RowLevelAdapterContractRecord[] = Object.freeze([
  Object.freeze({ id: "a-1", tenantId: "tenant-a", value: "A one" }),
  Object.freeze({ id: "a-2", tenantId: "tenant-a", value: "A two" }),
  Object.freeze({ id: "b-1", tenantId: "tenant-b", value: "B one" }),
]);

export function createRowLevelAdapterContract(
  createHarness: RowLevelAdapterContractHarnessFactory,
): readonly TenancyContractCase[] {
  return Object.freeze([
    contractCase("adapter isolates reads and counts", async (name) => {
      const harness = await preparedHarness(createHarness);
      await harness.runWithTenant("tenant-a", async () => {
        const records = await harness.findMany();
        assertContract(
          name,
          records.length === 2 &&
            records.every((record) => record.tenantId === "tenant-a"),
          "tenant read returned records outside its scope",
        );
        assertContract(
          name,
          (await harness.count()) === 2,
          "tenant count crossed scopes",
        );
      });
    }),
    contractCase("adapter injects tenant identity on create", async (name) => {
      const harness = await preparedHarness(createHarness);
      const created = await harness.runWithTenant("tenant-a", () =>
        harness.create({ id: "a-3", value: "A three" }),
      );
      assertContract(
        name,
        created.tenantId === "tenant-a",
        "create did not inject the active tenant",
      );

      let conflict: unknown;
      try {
        await harness.runWithTenant("tenant-a", () =>
          harness.create({
            id: "bad",
            tenantId: "tenant-b",
            value: "tampered",
          }),
        );
      } catch (error) {
        conflict = error;
      }
      assertContract(
        name,
        conflict !== undefined,
        "conflicting create tenant was accepted",
      );
    }),
    contractCase("adapter isolates bulk updates", async (name) => {
      const harness = await preparedHarness(createHarness);
      const affected = await harness.runWithTenant("tenant-a", () =>
        harness.updateMany("updated"),
      );
      const all = await harness.runInCentralContext(() => harness.findMany());
      assertContract(name, affected === 2, "bulk update count crossed scopes");
      assertContract(
        name,
        all
          .filter((record) => record.tenantId === "tenant-a")
          .every((record) => record.value === "updated") &&
          all.find((record) => record.tenantId === "tenant-b")?.value ===
            "B one",
        "bulk update mutated another tenant",
      );
    }),
    contractCase("adapter isolates bulk deletes", async (name) => {
      const harness = await preparedHarness(createHarness);
      const affected = await harness.runWithTenant("tenant-a", () =>
        harness.deleteMany(),
      );
      const all = await harness.runInCentralContext(() => harness.findMany());
      assertContract(name, affected === 2, "bulk delete count crossed scopes");
      assertContract(
        name,
        all.length === 1 && all[0]?.tenantId === "tenant-b",
        "bulk delete removed another tenant",
      );
    }),
    contractCase("adapter fails without tenant context", async (name) => {
      const harness = await preparedHarness(createHarness);
      let error: unknown;
      try {
        await harness.findMany();
      } catch (caught) {
        error = caught;
      }
      assertContract(
        name,
        error !== undefined,
        "context-free tenant access did not fail",
      );
    }),
    contractCase("adapter central context is explicit", async (name) => {
      const harness = await preparedHarness(createHarness);
      const all = await harness.runInCentralContext(() => harness.findMany());
      assertContract(
        name,
        all.length === SEEDED_RECORDS.length,
        "central context did not expose the reviewed administrative scope",
      );
    }),
    contractCase(
      "adapter transactions retain scope and roll back failures",
      async (name) => {
        const harness = await preparedHarness(createHarness);
        await harness.runWithTenant("tenant-a", () =>
          harness.transaction(async (operations) => {
            await operations.create({ id: "a-3", value: "transaction" });
            assertContract(
              name,
              (await operations.count()) === 3,
              "transaction lost tenant scope",
            );
          }),
        );

        let failure: unknown;
        try {
          await harness.runWithTenant("tenant-a", () =>
            harness.transaction(async (operations) => {
              await operations.create({ id: "rolled-back", value: "rollback" });
              throw new Error("contract rollback");
            }),
          );
        } catch (error) {
          failure = error;
        }
        assertContract(name, failure !== undefined, "transaction did not fail");
        const records = await harness.runWithTenant("tenant-a", () =>
          harness.findMany(),
        );
        assertContract(
          name,
          records.length === 3 &&
            records.every((record) => record.id !== "rolled-back"),
          "failed transaction did not roll back",
        );
      },
    ),
  ]);
}

async function preparedHarness(
  createHarness: RowLevelAdapterContractHarnessFactory,
) {
  const harness = await createHarness();
  await harness.reset();
  await harness.seed(SEEDED_RECORDS);
  return harness;
}

function contractCase(
  name: string,
  run: (name: string) => Promise<void>,
): TenancyContractCase {
  return Object.freeze({ name, run: () => run(name) });
}
