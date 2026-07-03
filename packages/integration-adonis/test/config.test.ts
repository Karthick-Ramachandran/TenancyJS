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
