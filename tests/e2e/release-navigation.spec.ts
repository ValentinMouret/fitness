import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

for (const path of ["/workouts", "/measurements"]) {
  test(`idle ${path} adopts a document only when leaving through a tab`, async ({
    page,
  }) => {
    await page.goto(path);
    const documents: string[] = [];
    page.on("request", (request) => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame())
        documents.push(new URL(request.url()).pathname);
    });
    const tabs = page.locator(".bottom-tabs");
    await tabs.getByRole("link", { name: "Nutrition", exact: true }).click();
    await expect(page).toHaveURL("/nutrition");
    expect(documents).toEqual(["/nutrition"]);
  });

  test(`${path} keeps same-tab revalidation on client navigation`, async ({
    page,
  }) => {
    await page.goto(path);
    const documents: string[] = [];
    page.on("request", (request) => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame())
        documents.push(new URL(request.url()).pathname);
    });
    const samePage = page.waitForResponse(
      (response) => new URL(response.url()).pathname === `${path}.data`,
    );
    await page.locator(".bottom-tabs").locator(`a[href="${path}"]`).click();
    await samePage;
    await expect(page).toHaveURL(path);
    expect(documents).toEqual([]);
  });
}

test("a pending list revalidation keeps outgoing tabs on client navigation", async ({
  page,
}) => {
  await page.goto("/workouts");
  let received = () => {};
  const pending = new Promise<void>((resolve) => {
    received = resolve;
  });
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/workouts.data*", async (route) => {
    received();
    await held;
    await route.abort().catch(() => {});
  });
  const documents: string[] = [];
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      documents.push(new URL(request.url()).pathname);
  });
  await page
    .locator(".bottom-tabs")
    .getByRole("link", { name: "Workouts", exact: true })
    .click();
  await pending;
  await page
    .locator(".bottom-tabs")
    .getByRole("link", { name: "Nutrition", exact: true })
    .click();
  await expect(page).toHaveURL("/nutrition");
  expect(documents).toEqual([]);
  release();
  await page.unrouteAll({ behavior: "wait" });
});

test("leaving a meal builder keeps client navigation", async ({ page }) => {
  await page.goto("/nutrition/meal-builder");
  await page.getByPlaceholder("Enter calories").fill("2345");
  const documents: string[] = [];
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      documents.push(request.url());
  });
  await page
    .locator(".bottom-tabs")
    .getByRole("link", { name: "Workouts", exact: true })
    .click();
  await expect(page).toHaveURL("/workouts");
  expect(documents).toEqual([]);
});

test("a pending list action keeps outgoing tabs on client navigation", async ({
  page,
}) => {
  await page.goto("/workouts");
  let submitted = () => {};
  const pending = new Promise<void>((resolve) => {
    submitted = resolve;
  });
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/workouts/create*", async (route) => {
    submitted();
    await held;
    await route.abort().catch(() => {});
  });
  const documents: string[] = [];
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      documents.push(request.url());
  });
  await page
    .getByRole("button", { name: "Start Workout", exact: true })
    .click();
  await pending;
  await expect(
    page.getByRole("button", { name: /^Start Workout/ }),
  ).toBeDisabled();
  await page
    .locator(".bottom-tabs")
    .getByRole("link", { name: "Nutrition", exact: true })
    .click();
  await expect(page).toHaveURL("/nutrition");
  expect(documents).toEqual([]);
  release();
  await page.unrouteAll({ behavior: "wait" });
});
