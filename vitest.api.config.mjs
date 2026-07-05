import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vitest/config";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(rootDir, "src"),
      "server-only": resolve(rootDir, "tests/mocks/server-only.mjs"),
    },
  },
  test: {
    environment: "node",
    globals: false,
    passWithNoTests: false,
    setupFiles: ["./tests/api/setup.mjs"],
    include: ["tests/api/**/*.test.{js,mjs,cjs,ts,mts}"],
    exclude: ["node_modules", ".next", "tests/e2e/**", "tests/mcp/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "coverage/api",
      include: [
        "src/trpc/init.ts",
        "src/trpc/routers/_app.ts",
        "src/app/api/trpc/**/*.ts",
        "src/features/**/server/routers.ts",
        "src/lib/encryption.ts"
      ],
      exclude: ["src/generated/**", "src/**/*.tsx"],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
});
