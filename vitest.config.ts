import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const nodeMajor = Number.parseInt(process.versions.node.split(".")[0]!, 10);

export default defineConfig({
  resolve: {
    alias: {
      "@tenancyjs/adapter-knex": fileURLToPath(
        new URL("./packages/adapter-knex/src/index.ts", import.meta.url),
      ),
      "@tenancyjs/adapter-lucid": fileURLToPath(
        new URL("./packages/adapter-lucid/src/index.ts", import.meta.url),
      ),
      "@tenancyjs/adapter-prisma": fileURLToPath(
        new URL("./packages/adapter-prisma/src/index.ts", import.meta.url),
      ),
      "@tenancyjs/cli": fileURLToPath(
        new URL("./packages/cli/src/index.ts", import.meta.url),
      ),
      "@tenancyjs/core": fileURLToPath(
        new URL("./packages/core/src/index.ts", import.meta.url),
      ),
      "@tenancyjs/identifiers": fileURLToPath(
        new URL("./packages/identifiers/src/index.ts", import.meta.url),
      ),
      "@tenancyjs/integration-express": fileURLToPath(
        new URL("./packages/integration-express/src/index.ts", import.meta.url),
      ),
      "@tenancyjs/integration-next/edge": fileURLToPath(
        new URL("./packages/integration-next/src/edge.ts", import.meta.url),
      ),
      "@tenancyjs/integration-next": fileURLToPath(
        new URL("./packages/integration-next/src/index.ts", import.meta.url),
      ),
      "@tenancyjs/testing": fileURLToPath(
        new URL("./packages/testing/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    coverage: {
      exclude: ["**/dist/**", "packages/cli/src/bin.ts"],
      include: [
        "packages/adapter-knex/src/**/*.ts",
        "packages/adapter-lucid/src/**/*.ts",
        "packages/adapter-prisma/src/**/*.ts",
        "packages/cli/src/**/*.ts",
        "packages/core/src/**/*.ts",
        "packages/identifiers/src/**/*.ts",
        "packages/integration-express/src/**/*.ts",
        "packages/integration-next/src/**/*.ts",
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
    include: [
      "examples/**/*.test.ts",
      "tests/**/*.test.ts",
      "packages/**/*.test.ts",
    ],
    exclude:
      nodeMajor < 24
        ? ["packages/adapter-lucid/test/postgresql.integration.test.ts"]
        : [],
    passWithNoTests: false,
  },
});
