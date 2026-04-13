import { expect, test } from "@playwright/test";

test.describe("Nutrition Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/nutrition");
  });

  test("should display calorie ring and meals", async ({ page }) => {
    await expect(page.getByText("kcal target")).toBeVisible();
    await expect(page.getByText("Meals")).toBeVisible();
  });

  test("should display nutrition action links", async ({ page }) => {
    await expect(
      page.getByRole("link", { name: "Meal Builder" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Calculate Targets" }),
    ).toBeVisible();
  });

  test("should navigate to meal builder", async ({ page }) => {
    await page.getByRole("link", { name: "Meal Builder" }).click();
    await expect(page).toHaveURL(/\/nutrition\/meal-builder/);
  });
});
