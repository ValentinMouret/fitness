import { expect, test } from "@playwright/test";

test("retired measurement pages and actions are unavailable", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(
    page.locator('.bottom-tabs a[href="/measurements"]'),
  ).toHaveCount(0);

  for (const path of [
    "/measurements",
    "/measurements/new",
    "/measurements/weight",
    "/measurements.data",
    "/measurements/new.data",
    "/measurements/weight.data",
  ]) {
    expect((await page.request.get(path)).status(), path).toBe(404);
  }

  for (const [path, form] of [
    ["/measurements/new", { name: "Retired", unit: "cm" }],
    ["/measurements/weight", { intent: "add-measure", value: "75" }],
  ] as const) {
    expect((await page.request.post(path, { form })).status(), path).toBe(404);
  }
});
