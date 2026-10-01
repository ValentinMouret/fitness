import { defineConfig } from "vitest/config";
import base from "./vitest.config";

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    env: {},
    include: [
      "tests/integration/ownership-stack.integration.test.ts",
      "app/modules/habits/**/*.integration.test.ts",
      "app/modules/core/**/*.integration.test.ts",
      "app/modules/fitness/infra/ownership.integration.test.ts",
      "app/modules/fitness/infra/workout-migration-compatibility.integration.test.ts",
      "app/modules/fitness/infra/equipment-ownership.integration.test.ts",
      "app/modules/fitness/infra/exercise-preferences.integration.test.ts",
      "app/modules/nutrition/infra/ownership.integration.test.ts",
    ],
    exclude: ["node_modules/**"],
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
