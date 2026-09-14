import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { expect, request, test as setup } from "@playwright/test";
import { login } from "./support/auth";

const authFile = "playwright/.auth/user.json";
setup("authenticate e2e user", async ({ page, baseURL }) => {
  await mkdir(dirname(authFile), { recursive: true });

  await login(page);

  await page.context().storageState({ path: authFile });

  const api = await request.newContext({
    baseURL,
    storageState: authFile,
  });

  const response = await api.post("/workouts/exercises/create", {
    form: {
      name: `E2E Test Bench Press ${Date.now()}`,
      type: "barbell",
      movementPattern: "push",
    },
  });

  expect(response.ok()).toBeTruthy();

  await api.dispose();
});
