import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { expect, request, test as setup } from "@playwright/test";

const authFile = "playwright/.auth/user.json";
const baseURL = "http://127.0.0.1:5175";

setup("authenticate e2e user", async ({ page }) => {
  await mkdir(dirname(authFile), { recursive: true });

  await page.context().addCookies([
    {
      name: "fitness-rr-session",
      value: encodeURIComponent(JSON.stringify({ username: "testuser" })),
      url: baseURL,
      sameSite: "Strict",
    },
  ]);

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
