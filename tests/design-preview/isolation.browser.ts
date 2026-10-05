import { expect, test } from "@playwright/test";

test("preview exposes synthetic pages and excludes application endpoints", async ({
  request,
}) => {
  const health = await request.get("/healthz");
  expect(health.ok()).toBe(true);
  expect(await health.json()).toMatchObject({
    status: "ok",
    mode: "synthetic-design-preview",
  });
  expect(health.headers()["cache-control"]).toBe("no-store");
  expect((await request.get("/")).url()).toContain("/design/type");
  for (const path of [
    "/login",
    "/signup",
    "/logout",
    "/auth/login",
    "/api/auth/session",
    "/oauth/authorize",
    "/oauth/token",
    "/mcp",
    "/nutrition",
    "/workouts",
    "/habits",
    "/share/example",
  ]) {
    expect((await request.get(path)).status(), path).toBe(404);
    expect((await request.post(path, { data: {} })).status(), path).toBe(404);
  }
  for (const path of [
    "/design/type/invalid",
    "/design/type/sans?screen=invalid",
  ]) {
    expect((await request.get(path)).status()).toBe(404);
    expect((await request.post(path, { data: {} })).status()).toBe(405);
  }
  for (const path of ["/healthz", "/design/type", "/design/type/editorial"]) {
    expect((await request.post(path, { data: {} })).status(), path).toBe(405);
  }
});

for (const width of [320, 390]) {
  test(`synthetic screens work without mutations at ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const mutations: string[] = [];
    page.on("request", (request) => {
      if (!["GET", "HEAD"].includes(request.method()))
        mutations.push(request.url());
    });
    await page.goto("/design/type");
    await expect(
      page.getByRole("heading", { name: "One voice for Fitness" }),
    ).toBeVisible();
    for (const variant of ["editorial", "sans"]) {
      for (const screen of [
        "workout",
        "dashboard",
        "nutrition",
        "habits",
        "editor",
        "public",
        "auth",
      ]) {
        await page.goto(`/design/type/${variant}?screen=${screen}&saved=warm`);
        await expect(page.getByRole("combobox")).toHaveValue(screen);
        await page.evaluate(() => document.fonts.ready);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${variant}/${screen}`,
        ).toBe(true);
      }
    }
    await page.getByRole("button", { name: "Send sign-in link" }).click();
    await expect(
      page.getByText("Check your email · sample message only"),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText("Check your email · sample message only"),
    ).toHaveCount(0);
    await page.goto("/design/type/editorial?screen=workout&saved=warm");
    await page.getByRole("button", { name: "Edit set 2 effort" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Stored RIR: 3")).toBeVisible();
    await dialog.getByRole("button", { name: "1", exact: true }).click();
    await expect(dialog.getByText("Stored RIR: 1")).toBeVisible();
    await dialog.getByRole("button", { name: "Close details" }).click();
    await page.screenshot({ path: `/tmp/design-preview-${width}.png` });
    await page.reload();
    await page.getByRole("button", { name: "Edit set 2 effort" }).click();
    await expect(
      page.getByRole("dialog").getByText("Stored RIR: 3"),
    ).toBeVisible();
    expect(mutations).toEqual([]);
    expect(await context.cookies()).toEqual([]);
    expect(await page.locator('link[rel="manifest"]').count()).toBe(0);
    expect(
      await page.evaluate(
        async () => (await navigator.serviceWorker.getRegistrations()).length,
      ),
    ).toBe(0);
  });
}
