import { TenancyManager, TenantContextError } from "@tenancyjs/core";
import type { TenantRecord } from "@tenancyjs/core";

import { assertContract } from "./assertion.js";
import { createTenantFixture } from "./fixtures.js";
import type {
  TenancyContractCase,
  TenancyIntegrationHarnessFactory,
} from "./types.js";

export function createCoreTenancyContract(): readonly TenancyContractCase[] {
  return Object.freeze([
    contractCase("core exposes and clears one tenant scope", async (name) => {
      const manager = new TenancyManager();
      const tenant = createTenantFixture();
      await manager.runWithTenant(tenant, async () => {
        assertContract(
          name,
          manager.getTenantOrFail().id === tenant.id,
          "active tenant was not visible",
        );
      });
      assertContract(name, manager.getContext() === undefined, "scope leaked");
    }),
    contractCase("core isolates concurrent tenant scopes", async (name) => {
      const manager = new TenancyManager();
      const first = createTenantFixture({ id: "tenant-a" });
      const second = createTenantFixture({ id: "tenant-b", name: "Tenant B" });
      const observed = await Promise.all(
        [first, second].map((tenant) =>
          manager.runWithTenant(tenant, async () => {
            await Promise.resolve();
            return manager.getTenantOrFail().id;
          }),
        ),
      );
      assertContract(
        name,
        observed.join(",") === "tenant-a,tenant-b",
        "concurrent tenant contexts crossed",
      );
    }),
    contractCase("core central scope fails closed", async (name) => {
      const manager = new TenancyManager();
      await manager.runInCentralContext(async () => {
        let error: unknown;
        try {
          manager.getTenantOrFail();
        } catch (caught) {
          error = caught;
        }
        assertContract(
          name,
          error instanceof TenantContextError && error.reason === "central",
          "central scope exposed tenant access",
        );
      });
    }),
  ]);
}

export function createIntegrationTenancyContract<TTenant extends TenantRecord>(
  createHarness: TenancyIntegrationHarnessFactory<TTenant>,
  tenants: readonly [TTenant, TTenant],
): readonly TenancyContractCase[] {
  return Object.freeze([
    contractCase(
      "integration exposes and clears tenant context",
      async (name) => {
        const harness = createHarness();
        await harness.execute(tenants[0], async () => {
          assertContract(
            name,
            tenantIdOrFail(name, harness.manager) === tenants[0].id,
            "integration did not expose the resolved tenant",
          );
        });
        assertContract(
          name,
          harness.manager.getContext() === undefined,
          "integration leaked tenant context",
        );
      },
    ),
    contractCase("integration cleans up callback failures", async (name) => {
      const harness = createHarness();
      const failure = new Error("contract callback failure");
      let caught: unknown;
      try {
        await harness.execute(tenants[0], async () => {
          throw failure;
        });
      } catch (error) {
        caught = error;
      }
      assertContract(
        name,
        caught === failure,
        "callback error identity changed",
      );
      assertContract(
        name,
        harness.manager.getContext() === undefined,
        "failed callback leaked tenant context",
      );
    }),
    contractCase("integration isolates concurrent tenants", async (name) => {
      const harness = createHarness();
      const observed = await Promise.all(
        tenants.map((tenant) =>
          harness.execute(tenant, async () => {
            await Promise.resolve();
            return tenantIdOrFail(name, harness.manager);
          }),
        ),
      );
      assertContract(
        name,
        observed[0] === tenants[0].id && observed[1] === tenants[1].id,
        "integration crossed concurrent tenant contexts",
      );
    }),
  ]);
}

function contractCase(
  name: string,
  run: (name: string) => Promise<void>,
): TenancyContractCase {
  return Object.freeze({ name, run: () => run(name) });
}

function tenantIdOrFail<TTenant extends TenantRecord>(
  caseName: string,
  manager: TenancyManager<TTenant>,
): string {
  try {
    return manager.getTenantOrFail().id;
  } catch {
    assertContract(caseName, false, "tenant context was unavailable");
  }
}
