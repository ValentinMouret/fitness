import {
  type APIRequestContext,
  type APIResponse,
  expect,
  type Page,
} from "@playwright/test";
import { z } from "zod";

export const authTestEnv = z
  .object({
    TEST_PORT: z.coerce.number().int().min(1).max(65535).default(5175),
    E2E_BASE_URL: z.url().optional(),
    E2E_AUTH_USERNAME: z.string().min(1).default("testuser"),
    E2E_AUTH_PASSWORD: z.string().min(1).default("testpassword"),
  })
  .transform((settings) => ({
    ...settings,
    E2E_BASE_URL:
      settings.E2E_BASE_URL ?? `http://127.0.0.1:${settings.TEST_PORT}`,
  }))
  .parse(process.env);

export const sessionCookieName = "fitness-rr-session";
export const credentials = {
  username: authTestEnv.E2E_AUTH_USERNAME,
  password: authTestEnv.E2E_AUTH_PASSWORD,
};

export async function login(page: Page, redirectTo = "/dashboard") {
  await page.goto(`/login?${new URLSearchParams({ redirectTo })}`);
  await page.getByPlaceholder("Enter your username").fill(credentials.username);
  await page.getByPlaceholder("Enter your password").fill(credentials.password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(
    new URL(redirectTo, authTestEnv.E2E_BASE_URL).href,
  );
}

export async function loginWithRequest(request: APIRequestContext) {
  const response = await request.post("/login", {
    form: credentials,
    maxRedirects: 0,
  });
  expect([302, 303]).toContain(response.status());
  expect(response.headers().location).toBe("/dashboard");
  const state = await request.storageState();
  const cookie = state.cookies.find(({ name }) => name === sessionCookieName);
  if (!cookie)
    throw new Error("Successful login did not issue a session cookie");
  return cookie;
}

export function expectUnauthenticated(response: APIResponse) {
  if ([302, 303].includes(response.status())) {
    const location = new URL(response.headers().location, response.url());
    expect(location.origin).toBe(new URL(response.url()).origin);
    expect(location.pathname).toBe("/login");
  } else {
    expect(response.status()).toBe(401);
  }
}
