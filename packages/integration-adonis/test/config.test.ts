import { TenancyManager } from "@tenancyjs/core";
import { describe, expect, it } from "vitest";

import {
  AdonisTenancyConfigurationError,
  defineAdonisTenancyConfig,
} from "../src/index.js";
import {
  countingResolver,
  recordingTenancy,
  resolvedOutcome,
  type TestTenant,
} from "./support.js";

function validOptions() {
  return {
    manager: new TenancyManager<TestTenant>(),
    resolver: countingResolver(resolvedOutcome({ id: "tenant-a", name: "A" })),
    tenancy: recordingTenancy(),
  };
}

describe("defineAdonisTenancyConfig", () => {
  it("returns a frozen config with a default error handler", () => {
    const config = defineAdonisTenancyConfig(validOptions());
    expect(Object.isFrozen(config)).toBe(true);
    expect(typeof config.onError).toBe("function");
  });

  it("preserves a provided error handler", () => {
    const onError = (): void => {};
    const config = defineAdonisTenancyConfig({ ...validOptions(), onError });
    expect(config.onError).toBe(onError);
  });

  it("accepts a lazy tenancy factory and resolves it only on first access", () => {
    const tenancy = recordingTenancy();
    let calls = 0;
    const config = defineAdonisTenancyConfig({
      ...validOptions(),
      tenancy: () => {
        calls += 1;
        return tenancy;
      },
    });
    expect(calls).toBe(0);
    expect(config.tenancy).toBe(tenancy);
    expect(config.tenancy).toBe(tenancy);
    expect(calls).toBe(1);
  });

  it("throws when the tenancy factory returns an invalid service", () => {
    const config = defineAdonisTenancyConfig({
      ...validOptions(),
      tenancy: () => ({}) as never,
    });
    expect(() => config.tenancy).toThrowError(AdonisTenancyConfigurationError);
  });

  it.each([null, undefined, 42, "config"])(
    "rejects non-object options (%s)",
    (options) => {
      expect(() => defineAdonisTenancyConfig(options as never)).toThrowError(
        AdonisTenancyConfigurationError,
      );
    },
  );

  it("requires a manager with runWithTenant", () => {
    const { resolver, tenancy } = validOptions();
    expect(() =>
      defineAdonisTenancyConfig({ manager: {}, resolver, tenancy } as never),
    ).toThrowError(/TenancyManager/);
  });

  it("requires a resolver with resolve", () => {
    const { manager, tenancy } = validOptions();
    expect(() =>
      defineAdonisTenancyConfig({ manager, resolver: {}, tenancy } as never),
    ).toThrowError(/tenant resolver/);
  });

  it("requires a Lucid tenancy service with run and validate", () => {
    const { manager, resolver } = validOptions();
    expect(() =>
      defineAdonisTenancyConfig({
        manager,
        resolver,
        tenancy: { run: () => undefined },
      } as never),
    ).toThrowError(/Lucid tenancy service/);
  });

  it("requires onError to be a function when provided", () => {
    expect(() =>
      defineAdonisTenancyConfig({
        ...validOptions(),
        onError: "nope",
      } as never),
    ).toThrowError(/onError/);
  });
});
