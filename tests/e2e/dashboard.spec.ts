import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Dashboard Page", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should display dashboard components", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Today", exact: true }),
    ).toBeVisible();

    await expect(
      page.getByText("Weight", { exact: true }).first(),
    ).toBeVisible();

    await expect(
      page.getByText("Calories", { exact: true }).first(),
    ).toBeVisible();
  });

  test("should allow navigating to nutrition from dashboard", async ({
    page,
  }) => {
    await page.getByRole("link", { name: "Nutrition" }).first().click();
    await expect(page).toHaveURL(/\/nutrition/);
  });
});
