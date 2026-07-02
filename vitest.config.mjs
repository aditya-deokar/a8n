import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vitest/config";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(rootDir, "src"),
    },
  },
  test: {
    environment: "node",
    globals: false,
    passWithNoTests: true,
    setupFiles: ["./tests/mcp/setup.mjs"],
    include: ["tests/mcp/**/*.test.{js,mjs,cjs,ts,mts}"],
    exclude: ["node_modules", ".next", "tests/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "coverage/mcp",
      include: ["src/mcp/**/*.ts", "src/app/api/mcp/**/*.ts", "src/app/api/oauth/**/*.ts", "src/app/api/webhooks/**/*.ts"],
      exclude: ["src/mcp/evals/**"],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
});
