import { defineConfig } from "vitest/config";
import base from "./vitest.config";

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ["app/modules/mcp/**/*.integration.test.ts"],
    exclude: ["node_modules/**"],
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
