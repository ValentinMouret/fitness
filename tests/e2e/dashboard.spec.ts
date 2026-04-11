import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Dashboard Page", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should display stat banner with calories, protein, and weight", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: "Today", exact: true }),
    ).toBeVisible();

    await expect(page.getByText("kcal", { exact: true })).toBeVisible();
    await expect(page.getByText("protein g", { exact: true })).toBeVisible();
    await expect(page.getByText("kg", { exact: true })).toBeVisible();
    await expect(page.getByText("kcal remaining")).toBeVisible();
    await expect(page.getByText("of daily goal")).toBeVisible();
  });

  test("should display weight trend section", async ({ page }) => {
    await expect(page.getByText("Weight trend")).toBeVisible();
  });

  test("should allow navigating to nutrition from dashboard", async ({
    page,
  }) => {
    await page.getByRole("link", { name: "Nutrition" }).first().click();
    await expect(page).toHaveURL(/\/nutrition/);
  });
});
