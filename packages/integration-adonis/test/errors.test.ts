import { describe, expect, it } from "vitest";

import {
  AdonisTenancyConfigurationError,
  AdonisTenancyError,
  AdonisTenancyResolutionError,
} from "../src/index.js";
import type { AdonisTenancyResolutionFailure } from "../src/index.js";

describe("AdonisTenancyResolutionError", () => {
  it.each<[AdonisTenancyResolutionFailure, 400 | 404 | 500]>([
    ["no-identifier", 400],
    ["invalid", 400],
    ["not-found", 404],
    ["suspended", 404],
    ["ambiguous", 500],
  ])("maps %s to status %d", (reason, status) => {
    const error = new AdonisTenancyResolutionError(reason);
    expect(error).toBeInstanceOf(AdonisTenancyError);
    expect(error.reason).toBe(reason);
    expect(error.status).toBe(status);
    expect(error.code).toBe("E_TENANCY_ADONIS_RESOLUTION");
    expect(error.name).toBe("AdonisTenancyResolutionError");
  });

  it("does not leak identifiers in the message", () => {
    const error = new AdonisTenancyResolutionError("not-found");
    expect(error.message).toBe("Tenant was not found.");
  });
});

describe("AdonisTenancyConfigurationError", () => {
  it("carries the configuration code", () => {
    const error = new AdonisTenancyConfigurationError("bad");
    expect(error).toBeInstanceOf(AdonisTenancyError);
    expect(error.code).toBe("E_TENANCY_ADONIS_CONFIGURATION");
    expect(error.name).toBe("AdonisTenancyConfigurationError");
  });
});
