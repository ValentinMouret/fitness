import { expect, test } from "@playwright/test";

test.describe("Nutrition Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/nutrition");
  });

  test("should display daily nutrition summary and meals", async ({ page }) => {
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
    await expect(
      page.getByRole("heading", { name: "Current Totals" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "AI Suggest", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText(/satiety|fullness/i)).toHaveCount(0);
    await page.getByPlaceholder("Enter protein").fill("30");
    await expect(
      page.getByRole("progressbar", { name: "Protein progress" }),
    ).toHaveAttribute("aria-valuemax", "30");
    await page.getByRole("button", { name: "Add Ingredient (N)" }).click();
    const picker = page.getByRole("dialog");
    await expect(
      picker.getByRole("heading", { name: "Add Ingredient" }),
    ).toBeVisible();
    await picker
      .getByRole("button")
      .filter({ hasText: "kcal/100g" })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: "Selected Ingredients (1)" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save Template" }),
    ).toBeVisible();
  });
});
