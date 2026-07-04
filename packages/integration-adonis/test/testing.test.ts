import { TenancyManager } from "@tenancyjs/core";
import { describe, expect, it } from "vitest";

import { defineAdonisTenancyConfig } from "../src/index.js";
import { withTenant } from "../src/testing.js";
import {
  countingResolver,
  recordingTenancy,
  resolvedOutcome,
  type RecordingTenancy,
  type TestTenant,
} from "./support.js";

function build(tenancy: RecordingTenancy = recordingTenancy()) {
  const config = defineAdonisTenancyConfig<TestTenant>({
    manager: new TenancyManager<TestTenant>(),
    resolver: countingResolver(resolvedOutcome({ id: "tenant-a", name: "A" })),
    tenancy,
  });
  return { config, tenancy };
}

function tenantId(
  config: ReturnType<typeof build>["config"],
): string | undefined {
  const context = config.manager.getContext();
  return context?.mode === "tenant" ? context.tenant.id : undefined;
}

describe("withTenant", () => {
  it("runs the body inside tenant context and the Lucid transaction", async () => {
    const { config, tenancy } = build();
    let seen: string | undefined;

    const result = await withTenant(
      config,
      { id: "tenant-a", name: "A" },
      () => {
        tenancy.events.push("body");
        seen = tenantId(config);
        return "ok";
      },
    );

    expect(result).toBe("ok");
    expect(seen).toBe("tenant-a");
    expect(tenancy.events).toEqual(["run:start", "body", "run:commit"]);
    expect(config.manager.getContext()).toBeUndefined();
  });

  it("rolls back and propagates when the body throws", async () => {
    const { config, tenancy } = build();
    const failure = new Error("assertion failed");

    await expect(
      withTenant(config, { id: "tenant-a", name: "A" }, () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(tenancy.events).toEqual(["run:start", "run:rollback"]);
    expect(config.manager.getContext()).toBeUndefined();
  });
});
