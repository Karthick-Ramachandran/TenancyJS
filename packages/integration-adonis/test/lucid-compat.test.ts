import type { LucidTenancyAdapter } from "tenancyjs-adapter-lucid";
import { describe, expect, it } from "vitest";

import type { AdonisTenancyRunner } from "../src/index.js";

describe("Lucid adapter compatibility", () => {
  it("LucidTenancyAdapter satisfies the AdonisTenancyRunner contract", () => {
    // Compile-time proof: the real Lucid adapter is assignable to the structural
    // runner the integration depends on. A mismatch fails the typecheck.
    const runner: AdonisTenancyRunner =
      undefined as unknown as LucidTenancyAdapter;
    expect(runner).toBeUndefined();
  });
});
