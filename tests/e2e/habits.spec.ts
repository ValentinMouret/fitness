import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Habits Page", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/habits");
  });

  test("should display habits sections", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Habits", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Today's Habits")).toBeVisible();
    await expect(page.getByText("All Habits")).toBeVisible();
  });

  test("should have a button to create new habit", async ({ page }) => {
    await expect(page.getByRole("link", { name: "New Habit" })).toBeVisible();
  });

  test("should navigate to new habit page", async ({ page }) => {
    await page.getByRole("link", { name: "New Habit" }).click();
    await expect(page).toHaveURL(/\/habits\/new/);
  });
});
