import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("tenancy binary", () => {
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "tenancyjs-cli-binary-"));
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        dependencies: { express: "5.2.1", "@prisma/client": "7.8.0" },
      }),
    );
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("prints help successfully", () => {
    const result = runBinary(["--help"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("tenancyjs-cli init");
  });

  it("previews init without writing and emits parseable JSON", async () => {
    const result = runBinary(["init", "--root", root, "--json"]);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      schemaVersion: 1,
      command: "init",
      mode: "dry-run",
      actions: expect.arrayContaining([
        expect.objectContaining({ status: "create" }),
      ]),
    });
    await expect(
      import("node:fs/promises").then(({ readFile }) =>
        readFile(join(root, "tenancy.config.ts")),
      ),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("returns exit code 2 for usage errors", () => {
    const result = runBinary(["unknown"]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Unknown command: unknown");
  });
});

function runBinary(arguments_: readonly string[]) {
  return spawnSync(
    process.execPath,
    [join(process.cwd(), "packages/cli/dist/bin.js"), ...arguments_],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );
}
