import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    include: [
      "server/**/*.test.ts", 
      "server/**/*.spec.ts",
      "client/**/*.test.ts",
      "client/**/*.test.tsx",
      "client/**/*.spec.ts",
      "client/**/*.spec.tsx"
    ],
    // Run tests sequentially to prevent SQLite database locking issues
    // This is especially important for property-based tests that perform
    // multiple concurrent database operations
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    testTimeout: 60000,
  },
});
