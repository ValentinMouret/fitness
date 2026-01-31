import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Nutrition Page", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/nutrition");
  });

  test("should display nutrition summary", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Nutrition" }),
    ).toBeVisible();
    await expect(page.getByText("Today's Calories")).toBeVisible();
    await expect(page.getByText("Today's Meals")).toBeVisible();
  });

  test("should display nutrition tools", async ({ page }) => {
    await expect(page.getByText("Tools")).toBeVisible();
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
