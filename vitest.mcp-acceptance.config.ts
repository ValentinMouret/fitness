import { defineConfig } from "vitest/config";
import base from "./vitest.config";

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ["tests/integration/mcp-ownership-acceptance.integration.test.ts"],
    exclude: ["node_modules/**"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
