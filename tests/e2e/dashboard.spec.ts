import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Dashboard Page", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should display dashboard components", async ({ page }) => {
    // Check for the main header
    await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();

    // Check for "Today's Focus" section
    await expect(page.getByText("Today's Focus")).toBeVisible();

    // Check for Weight card
    await expect(page.getByText("Weight", { exact: true })).toBeVisible();

    // Check for Calories card
    await expect(page.getByText("Calories", { exact: true })).toBeVisible();
  });

  test("should allow navigating to nutrition from dashboard", async ({
    page,
  }) => {
    const calorieCard = page.locator("div").filter({ hasText: /^Calories/ });
    await calorieCard.getByRole("link", { name: "Log" }).click();
    await expect(page).toHaveURL(/\/nutrition\/meals/);
  });
});
