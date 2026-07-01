import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["**/dist/**"],
      include: ["packages/core/src/**/*.ts"],
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
