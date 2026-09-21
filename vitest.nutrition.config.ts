import { defineConfig } from "vitest/config";
import base from "./vitest.config";

const databaseUrl = process.env.NUTRITION_TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "Set NUTRITION_TEST_DATABASE_URL to a dedicated test database",
  );
}

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    env: { ...base.test?.env, DATABASE_URL: databaseUrl },
    include: ["app/modules/nutrition/**/*.integration.test.ts"],
    exclude: ["**/ai-ingredient.service.integration.test.ts"],
    fileParallelism: false,
  },
});
