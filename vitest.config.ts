import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@tenancyjs/adapter-prisma": fileURLToPath(
        new URL("./packages/adapter-prisma/src/index.ts", import.meta.url),
      ),
      "@tenancyjs/core": fileURLToPath(
        new URL("./packages/core/src/index.ts", import.meta.url),
      ),
      "@tenancyjs/identifiers": fileURLToPath(
        new URL("./packages/identifiers/src/index.ts", import.meta.url),
      ),
      "@tenancyjs/testing": fileURLToPath(
        new URL("./packages/testing/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    coverage: {
      exclude: ["**/dist/**"],
      include: [
        "packages/adapter-prisma/src/**/*.ts",
        "packages/core/src/**/*.ts",
        "packages/identifiers/src/**/*.ts",
        "packages/testing/src/**/*.ts",
      ],
      provider: "v8",
      reporter: ["text", "json-summary"],
      thresholds: {
        branches: 90,
        functions: 95,
        lines: 95,
        statements: 95,
      },
    },
    include: ["tests/**/*.test.ts", "packages/**/*.test.ts"],
    passWithNoTests: false,
  },
});
