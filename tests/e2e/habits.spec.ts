import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Habits Index", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/habits");
  });

  test("shows greeting and progress ring", async ({ page }) => {
    await expect(
      page.getByText(/Good morning\.|Morning done\. You showed up\./),
    ).toBeVisible();
    await expect(page.getByText("today", { exact: true })).toBeVisible();
  });

  test("tab bar has Today and Week links", async ({ page }) => {
    await expect(page.getByRole("link", { name: "Today" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Week" })).toBeVisible();
  });

  test("+ link navigates to /habits/new", async ({ page }) => {
    await page.getByRole("link", { name: "+" }).click();
    await expect(page).toHaveURL(/\/habits\/new/);
  });
});

test.describe("Create Habit", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/habits/new");
  });

  test("step 1: shows question, input and disabled next button", async ({
    page,
  }) => {
    await expect(page.getByText("Step 1 of 5")).toBeVisible();
    await expect(page.getByText("What's the habit?")).toBeVisible();
    await expect(page.getByPlaceholder("e.g. Morning Run")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Identity →" }),
    ).toBeDisabled();
  });

  test("typing a name enables the next button", async ({ page }) => {
    await page.getByPlaceholder("e.g. Morning Run").fill("Read");
    await expect(
      page.getByRole("button", { name: "Identity →" }),
    ).toBeEnabled();
  });

  test("cancel link navigates back to /habits", async ({ page }) => {
    await page.getByRole("link", { name: /Cancel/ }).click();
    await expect(page).toHaveURL(/\/habits$/);
  });

  test("back button navigates to previous step", async ({ page }) => {
    await page.getByPlaceholder("e.g. Morning Run").fill("Read");
    await page.getByRole("button", { name: "Identity →" }).click();
    await expect(page.getByText("Step 2 of 5")).toBeVisible();
    await page.getByRole("button", { name: "← Name" }).click();
    await expect(page.getByText("Step 1 of 5")).toBeVisible();
  });

  test("navigates through all 5 steps verifying each", async ({ page }) => {
    await page.getByPlaceholder("e.g. Morning Run").fill("Read");
    await page.getByRole("button", { name: "Identity →" }).click();

    await expect(page.getByText("Step 2 of 5")).toBeVisible();
    await expect(page.getByPlaceholder('Start with "I am…"')).toBeVisible();
    await page.getByRole("button", { name: "Schedule →" }).click();

    await expect(page.getByText("Step 3 of 5")).toBeVisible();
    await expect(page.getByRole("button", { name: "daily" })).toBeVisible();
    await expect(page.getByRole("button", { name: "weekly" })).toBeVisible();
    await expect(page.getByRole("button", { name: "monthly" })).toBeVisible();
    await page.getByRole("button", { name: "Safety →" }).click();

    await expect(page.getByText("Step 4 of 5")).toBeVisible();
    await expect(
      page.getByPlaceholder("e.g. Just put on your shoes"),
    ).toBeVisible();
    await expect(page.getByText("Keystone habit")).toBeVisible();
    await page.getByRole("button", { name: "Color →" }).click();

    await expect(page.getByText("Step 5 of 5")).toBeVisible();
  });

  test("full happy path: creates habit and redirects to /habits", async ({
    page,
  }) => {
    await page.getByPlaceholder("e.g. Morning Run").fill("E2E Test Habit");
    await page.getByRole("button", { name: "Identity →" }).click();
    await page.getByRole("button", { name: "Schedule →" }).click();
    await page.getByRole("button", { name: "Safety →" }).click();
    await page.getByRole("button", { name: "Color →" }).click();
    await page.getByRole("button", { name: "Add habit" }).click();
    await expect(page).toHaveURL(/\/habits$/);
  });
});

test.describe("Weekly Habits", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/habits/week");
  });

  test("shows heading and week date range", async ({ page }) => {
    await expect(page.getByText("Your week at a glance.")).toBeVisible();
    await expect(
      page.getByText(/[A-Z][a-z]+ \d+ .+ [A-Z][a-z]+ \d+/),
    ).toBeVisible();
  });

  test("shows progress ring with this week label", async ({ page }) => {
    await expect(page.getByText("this week", { exact: true })).toBeVisible();
  });

  test("shows all day column headers", async ({ page }) => {
    for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
      await expect(page.getByText(day).first()).toBeVisible();
    }
  });

  test("shows legend items", async ({ page }) => {
    await expect(page.getByText("Done")).toBeVisible();
    await expect(page.getByText("Missed")).toBeVisible();
    await expect(page.getByText("Today (tap)")).toBeVisible();
  });

  test("Week tab is active in tab bar", async ({ page }) => {
    const weekLink = page.getByRole("link", { name: "Week" });
    await expect(weekLink).toBeVisible();
    // Active tab has red background (#e15a46), inactive is transparent
    const bg = await weekLink.evaluate(
      (el) => (el as HTMLElement).style.background,
    );
    expect(bg).toBe("rgb(225, 90, 70)");
  });
});
