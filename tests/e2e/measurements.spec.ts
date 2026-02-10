import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Measurements Page", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
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

    // One of them should be visible
    const either = (await emptyState.isVisible()) || (await grid.isVisible());
    expect(either).toBeTruthy();
  });

  test("should navigate to new measurement page", async ({ page }) => {
    await page.getByRole("link", { name: "New Measurement" }).click();
    await expect(page).toHaveURL(/\/measurements\/new/);
  });
});
