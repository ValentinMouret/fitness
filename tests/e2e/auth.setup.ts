import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { expect, request, test as setup } from "@playwright/test";

const authFile = "playwright/.auth/user.json";
const baseURL = "http://127.0.0.1:5175";

setup("authenticate e2e user", async () => {
  await mkdir(dirname(authFile), { recursive: true });

  const api = await request.newContext({ baseURL });
  const credentials = {
    email: "testuser@example.com",
    password: "password1234",
  };

  const signUpResponse = await api.post("/api/auth/sign-up/email", {
    data: {
      ...credentials,
      name: "Test User",
    },
  });

  if (!signUpResponse.ok()) {
    const signInResponse = await api.post("/api/auth/sign-in/email", {
      data: credentials,
    });

    expect(signInResponse.ok()).toBeTruthy();
  }

  await api.storageState({ path: authFile });

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
