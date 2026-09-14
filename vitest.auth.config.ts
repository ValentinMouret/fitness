import { defineConfig } from "vitest/config";
import base from "./vitest.config";

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    env: {},
    include: ["app/modules/auth/**/*.integration.test.ts"],
    exclude: ["node_modules/**"],
    fileParallelism: false,
  },
});
