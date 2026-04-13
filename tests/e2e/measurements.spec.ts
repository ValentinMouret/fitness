import { expect, test } from "@playwright/test";

test.describe("Measurements Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/measurements");
  });

  test("should display measurements header", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Measurements" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "New Measurement" }),
    ).toBeVisible();
  });

  test("should show empty state or grid", async ({ page }) => {
    const emptyState = page.getByText("No measurements configured");
    const grid = page.locator(".rt-Grid");

    await expect
      .poll(
        async () => (await emptyState.isVisible()) || (await grid.isVisible()),
      )
      .toBe(true);
  });

  test("should navigate to new measurement page", async ({ page }) => {
    await page.getByRole("link", { name: "New Measurement" }).click();
    await expect(page).toHaveURL(/\/measurements\/new/);
  });
});
