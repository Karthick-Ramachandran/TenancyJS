import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { withRuntime } from "../src/runtime-command.js";

const FIXTURES = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "runtime",
);

const validConfig = { root: FIXTURES, configPath: "valid.config.mjs" };

describe("withRuntime", () => {
  it("loads, runs, and disposes the runtime", async () => {
    const disposed: string[] = [];
    const result = await withRuntime(validConfig, async (runtime) => {
      const original = runtime.dispose.bind(runtime);
      runtime.dispose = async () => {
        disposed.push("yes");
        await original();
      };
      return runtime.adapters.length;
    });
    expect(result).toBe(0);
    expect(disposed).toEqual(["yes"]);
  });

  it("disposes even when the command throws, preserving the command error", async () => {
    const boom = new Error("command failed");
    await expect(
      withRuntime(validConfig, async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
  });

  it("surfaces a disposal error when the command succeeded", async () => {
    await expect(
      withRuntime(
        { root: FIXTURES, configPath: "dispose-throws.config.mjs" },
        async () => "ok",
      ),
    ).rejects.toThrow(/dispose failed/);
  });
});
