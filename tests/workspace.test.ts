import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

type PackageManifest = {
  name?: string;
  private?: boolean;
  packageManager?: string;
  engines?: { node?: string };
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  exports?: Record<string, unknown>;
};

async function readJson(path: string): Promise<PackageManifest> {
  return JSON.parse(await readFile(path, "utf8")) as PackageManifest;
}

describe("workspace foundation", () => {
  it("pins pnpm and requires Node.js 24 across every workspace project", async () => {
    const manifest = await readJson("package.json");

    expect(manifest.private).toBe(true);
    expect(manifest.packageManager).toMatch(/^pnpm@\d+\.\d+\.\d+$/);
    expect(manifest.engines?.node).toBe(">=24");

    for (const path of [
      "packages/adapter-knex/package.json",
      "packages/adapter-lucid/package.json",
      "packages/adapter-prisma/package.json",
      "packages/adapter-shared/package.json",
      "packages/cli/package.json",
      "packages/core/package.json",
      "packages/identifiers/package.json",
      "packages/integration-express/package.json",
      "packages/integration-next/package.json",
      "packages/testing/package.json",
    ]) {
      await expect(readJson(path)).resolves.toMatchObject({
        engines: { node: ">=24" },
      });
    }
  });

  it("keeps the core package free of framework and ORM dependencies", async () => {
    const manifest = await readJson("packages/core/package.json");

    expect(manifest.name).toBe("tenancyjs-core");
    expect(manifest.dependencies ?? {}).toEqual({});
    expect(manifest.peerDependencies ?? {}).toEqual({});
    expect(manifest.exports).toHaveProperty(".");
  });

  it("keeps identifiers and testing dependent only on core at runtime", async () => {
    for (const packageName of ["identifiers", "testing"]) {
      const manifest = await readJson(`packages/${packageName}/package.json`);

      expect(manifest.dependencies).toEqual({
        "tenancyjs-core": "workspace:*",
      });
      expect(manifest.peerDependencies ?? {}).toEqual({});
      expect(manifest.exports).toHaveProperty(".");
    }
  });

  it("keeps Prisma isolated to its adapter package", async () => {
    const manifest = await readJson("packages/adapter-prisma/package.json");

    expect(manifest.dependencies).toEqual({
      "tenancyjs-adapter-shared": "workspace:*",
      "tenancyjs-core": "workspace:*",
    });
    expect(manifest.peerDependencies).toEqual({
      "@prisma/client": ">=7.8.0 <7.9.0",
    });
    expect(manifest.exports).toHaveProperty(".");
  });

  it("builds an importable ESM core package entry point", async () => {
    const entry = pathToFileURL(
      `${process.cwd()}/packages/core/dist/index.js`,
    ).href;

    const module = await import(entry);

    expect(module).toHaveProperty("TenancyManager");
    expect(module).toHaveProperty("defineConfig");
    expect(module).toHaveProperty("TenantContextError");
  });

  it("documents the tenancy strategies and the current release status", async () => {
    const readme = await readFile("README.md", "utf8");

    expect(readme).toContain("Single database");
    expect(readme).toContain("Database per tenant");
    expect(readme).toContain("`0.1.0`");
  });
});
