import { expect, test } from "@playwright/test";
import {
  authTestEnv,
  credentials,
  expectUnauthenticated,
  login,
  loginWithRequest,
  sessionCookieName,
} from "../support/auth";

test.use({ storageState: { cookies: [], origins: [] }, trace: "off" });

test("login persists through navigation, reload, a new tab, and a restored browser session", async ({
  page,
  browser,
}) => {
  await login(page);
  await page.goto("/habits");
  await expect(page).toHaveURL(/\/habits$/);
  await page.reload();
  await expect(page).toHaveURL(/\/habits$/);
  const tab = await page.context().newPage();
  await tab.goto("/dashboard");
  await expect(tab).toHaveURL(/\/dashboard$/);

  const restored = await browser.newContext({
    baseURL: authTestEnv.E2E_BASE_URL,
    storageState: await page.context().storageState(),
  });
  try {
    const reopened = await restored.newPage();
    await reopened.goto("/dashboard");
    await expect(reopened).toHaveURL(/\/dashboard$/);
  } finally {
    await restored.close();
  }
});

for (const form of [
  { username: credentials.username, password: "incorrect-password" },
  { username: "incorrect-user", password: credentials.password },
  { username: "", password: credentials.password },
  { username: credentials.username, password: "" },
]) {
  test(`invalid credentials issue no session (${form.username ? "username present" : "username missing"}, ${form.password === credentials.password ? "configured password" : form.password ? "wrong password" : "password missing"})`, async ({
    request,
  }) => {
    const response = await request.post("/login", { form, maxRedirects: 0 });
    expect([200, 400, 401]).toContain(response.status());
    expect(
      (await request.storageState()).cookies.some(
        ({ name }) => name === sessionCookieName,
      ),
    ).toBe(false);
    expectUnauthenticated(await request.get("/dashboard", { maxRedirects: 0 }));
  });
}

test("session is persistent, HttpOnly, and restricted to the application host", async ({
  request,
  page,
}) => {
  const cookie = await loginWithRequest(request);
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.path).toBe("/");
  expect(cookie.domain).toBe(new URL(authTestEnv.E2E_BASE_URL).hostname);
  expect(["Lax", "Strict"]).toContain(cookie.sameSite);
  expect(cookie.expires).toBeGreaterThan(Date.now() / 1000);
  await page.context().addCookies([cookie]);
  await page.goto("/dashboard");
  const visible = await page.evaluate(() => document.cookie);
  expect(visible.includes(`${sessionCookieName}=`)).toBe(false);
});

test("HTTPS login issues a Secure cookie", async ({ request }) => {
  test.skip(
    new URL(authTestEnv.E2E_BASE_URL).protocol !== "https:",
    "Requires the HTTPS deployment; HTTP cannot verify transport security",
  );
  expect((await loginWithRequest(request)).secure).toBe(true);
});

for (const [name, value] of [
  [
    "legacy unsigned owner",
    encodeURIComponent(JSON.stringify({ username: credentials.username })),
  ],
  [
    "invented owner",
    encodeURIComponent(JSON.stringify({ username: "attacker" })),
  ],
  ["malformed JSON", "%7B"],
  ["malformed percent encoding", "%E0%A4%A"],
  ["wrong payload type", "true"],
]) {
  test(`rejects ${name} cookie`, async ({ request }) => {
    const response = await request.get("/dashboard", {
      headers: { Cookie: `${sessionCookieName}=${value}` },
      maxRedirects: 0,
    });
    expectUnauthenticated(response);
  });
}

test("rejects a tampered session issued by real login", async ({
  playwright,
}) => {
  const owner = await playwright.request.newContext({
    baseURL: authTestEnv.E2E_BASE_URL,
  });
  const attacker = await playwright.request.newContext({
    baseURL: authTestEnv.E2E_BASE_URL,
  });
  try {
    const cookie = await loginWithRequest(owner);
    const index = Math.floor(cookie.value.length / 2);
    const value =
      cookie.value.slice(0, index) +
      (cookie.value[index] === "A" ? "B" : "A") +
      cookie.value.slice(index + 1);
    expectUnauthenticated(
      await attacker.get("/dashboard", {
        headers: { Cookie: `${sessionCookieName}=${value}` },
        maxRedirects: 0,
      }),
    );
  } finally {
    await owner.dispose();
    await attacker.dispose();
  }
});

test("browser storage cannot authenticate the owner", async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "fitness-rr-auth",
      JSON.stringify({ username: "attacker" }),
    );
  });
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?/);
  await expect(
    page.getByRole("button", { name: "Login", exact: true }),
  ).toBeVisible();
});

test("login preserves a safe local destination and query", async ({ page }) => {
  await login(page, "/workouts/exercises?q=bench");
});

test("client navigation to a loaderless page checks the session before showing its form", async ({
  page,
}) => {
  await login(page, "/measurements");
  const link = page.getByRole("link", { name: /^New Measurement\b/ });
  await expect(link).toBeVisible();
  await page.context().clearCookies({ name: sessionCookieName });
  const dataRequest = page.waitForRequest(
    (request) => new URL(request.url()).pathname === "/measurements/new.data",
  );
  await link.click();
  await dataRequest;
  await expect(page).toHaveURL(/\/login\?/);
  expect(new URL(page.url()).searchParams.get("redirectTo")).toBe(
    "/measurements/new",
  );
  await expect(
    page.getByRole("button", { name: "Login", exact: true }),
  ).toBeVisible();
});

for (const redirectTo of [
  "https://attacker.invalid/",
  "//attacker.invalid/",
  "/\\attacker.invalid/",
  "https%3A%2F%2Fattacker.invalid%2F",
]) {
  test(`login does not redirect externally: ${redirectTo}`, async ({
    request,
  }) => {
    const response = await request.post("/login", {
      form: { ...credentials, redirectTo },
      maxRedirects: 0,
    });
    expect([302, 303]).toContain(response.status());
    const destination = new URL(
      response.headers().location,
      authTestEnv.E2E_BASE_URL,
    );
    expect(destination.origin).toBe(new URL(authTestEnv.E2E_BASE_URL).origin);
  });
}

test("logout clears the browser session, including other open tabs", async ({
  page,
}) => {
  await login(page);
  const otherTab = await page.context().newPage();
  await otherTab.goto("/dashboard");
  const response = await page.request.post("/logout", { maxRedirects: 0 });
  expect([302, 303]).toContain(response.status());
  expect(
    (await page.context().cookies()).some(
      ({ name }) => name === sessionCookieName,
    ),
  ).toBe(false);
  await otherTab.reload();
  await expect(otherTab).toHaveURL(/\/login\?/);
  expectUnauthenticated(
    await page.request.get("/dashboard", { maxRedirects: 0 }),
  );
});
