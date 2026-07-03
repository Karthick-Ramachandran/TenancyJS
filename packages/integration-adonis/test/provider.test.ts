import { TenancyManager } from "@tenancyjs/core";
import { describe, expect, it } from "vitest";

import {
  AdonisTenancyConfigurationError,
  TenancyMiddleware,
  TenancyProvider,
  defineAdonisTenancyConfig,
} from "../src/index.js";
import {
  countingResolver,
  fakeApp,
  recordingTenancy,
  resolvedOutcome,
  type RecordingTenancy,
  type TestTenant,
} from "./support.js";

function buildConfig(tenancy: RecordingTenancy) {
  return defineAdonisTenancyConfig<TestTenant>({
    manager: new TenancyManager<TestTenant>(),
    resolver: countingResolver(resolvedOutcome({ id: "tenant-a", name: "A" })),
    tenancy,
  });
}

describe("TenancyProvider", () => {
  it("registers the tenant middleware as a container singleton", () => {
    const { app, bindings } = fakeApp(buildConfig(recordingTenancy()));

    new TenancyProvider(app).register();

    expect(bindings.has(TenancyMiddleware)).toBe(true);
    expect(bindings.get(TenancyMiddleware)!()).toBeInstanceOf(
      TenancyMiddleware,
    );
  });

  it("validates the Lucid policy during ready", async () => {
    const { app } = fakeApp(buildConfig(recordingTenancy()));
    await expect(new TenancyProvider(app).ready()).resolves.toBeUndefined();
  });

  it("fails closed during ready when policy validation fails", async () => {
    const tenancy = recordingTenancy();
    tenancy.setValid(false);
    const { app } = fakeApp(buildConfig(tenancy));

    await expect(new TenancyProvider(app).ready()).rejects.toBeInstanceOf(
      AdonisTenancyConfigurationError,
    );
  });

  it("shuts down without owning resources", async () => {
    const { app } = fakeApp(buildConfig(recordingTenancy()));
    await expect(new TenancyProvider(app).shutdown()).resolves.toBeUndefined();
  });
});
