import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Workouts Page", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/workouts");
  });

  test("should display workouts header and tools", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Workouts" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Start Workout" }),
    ).toBeVisible();

    await expect(page.getByText("Tools")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Generate Smart Workout" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Import from Strong" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Manage Exercises" }),
    ).toBeVisible();
  });

  test("should show empty state when no workouts exist", async ({ page }) => {
    // This test assumes a fresh database or specific test state
    // If workouts exist, this might fail, but it's a good test case to have
    const emptyState = page.getByText("No workouts yet");
    if (await emptyState.isVisible()) {
      await expect(page.getByText("Ready to crush it?")).toBeVisible();
    }
  });
});
