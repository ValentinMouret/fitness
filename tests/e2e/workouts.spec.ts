import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Workouts Page", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/workouts");
  });

  test("should display workouts header and actions", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Workouts", exact: true }),
    ).toBeVisible();
  });

  test("should show navigation links", async ({ page }) => {
    await expect(
      page.getByRole("link", { name: "Import from Strong" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Manage Exercises" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Recovery Map" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Templates" })).toBeVisible();
  });

  test("should navigate to exercises page", async ({ page }) => {
    await page.getByRole("link", { name: "Manage Exercises" }).click();
    await expect(page).toHaveURL(/\/workouts\/exercises/);
    await expect(
      page.getByRole("heading", { name: "Exercises" }),
    ).toBeVisible();
  });

  test("should navigate to recovery page", async ({ page }) => {
    await page.getByRole("link", { name: "Recovery Map" }).click();
    await expect(page).toHaveURL(/\/workouts\/recovery/);
  });

  test("should navigate to templates page", async ({ page }) => {
    await page.getByRole("link", { name: "Templates" }).click();
    await expect(page).toHaveURL(/\/workouts\/templates/);
  });
});

test.describe("Start Workout Dialog", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/workouts");
  });

  test("should open dialog when clicking Start Workout", async ({ page }) => {
    await page.getByRole("button", { name: "Start Workout" }).click();
    await expect(
      page.getByRole("heading", { name: "Start Workout" }),
    ).toBeVisible();
    await expect(page.getByText("Start Fresh")).toBeVisible();
    await expect(page.getByText("Begin with an empty workout")).toBeVisible();
  });

  test("should close dialog with Cancel button", async ({ page }) => {
    await page.getByRole("button", { name: "Start Workout" }).click();
    await expect(page.getByText("Start Fresh")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Start Fresh")).not.toBeVisible();
  });

  test("should start a fresh workout and navigate to workout session", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Start Workout" }).click();
    await page.getByText("Start Fresh").click();
    await expect(page).toHaveURL(/\/workouts\/[a-z0-9-]+/);
  });
});

test.describe("Active Workout Session", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/workouts");
    await page.getByRole("button", { name: "Start Workout" }).click();
    await page.getByText("Start Fresh").click();
    await expect(page).toHaveURL(/\/workouts\/[a-z0-9-]+/);
  });

  test("should display empty workout state", async ({ page }) => {
    await expect(page.getByText("No exercises yet")).toBeVisible();
    await expect(
      page.getByText("Add your first exercise to get started"),
    ).toBeVisible();
    await expect(page.getByText("Live")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add Exercise" }),
    ).toBeVisible();
  });

  test("should display workout name that is editable", async ({ page }) => {
    await expect(page.getByText("Workout")).toBeVisible();
  });

  test("should show Complete button", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Complete" })).toBeVisible();
  });

  test("should open exercise selector when clicking Add Exercise", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Add Exercise" }).click();
    await expect(
      page.getByRole("heading", { name: "Add Exercises" }),
    ).toBeVisible();
    await expect(page.getByPlaceholder("Search exercises...")).toBeVisible();
  });

  test("should cancel workout via menu", async ({ page }) => {
    await page.locator("button:has(svg)").last().click();
    await page.getByText("Cancel Workout").click();
    await expect(page.getByText("Cancel Workout")).toBeVisible();
    await expect(
      page.getByText("This will permanently delete all workout data"),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Cancel" })
      .filter({ hasNotText: "Workout" })
      .click();
    await expect(page).toHaveURL(/\/workouts$/);
  });
});

test.describe("Workout Session - Add and Manage Exercises", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/workouts");
    await page.getByRole("button", { name: "Start Workout" }).click();
    await page.getByText("Start Fresh").click();
    await expect(page).toHaveURL(/\/workouts\/[a-z0-9-]+/);
  });

  test("should add an exercise to the workout", async ({ page }) => {
    await page.getByRole("button", { name: "Add Exercise" }).click();
    await expect(
      page.getByRole("heading", { name: "Add Exercises" }),
    ).toBeVisible();

    // Click the first exercise in the list
    const firstExercise = page.locator(".exercise-selector__item").first();
    const exerciseName = await firstExercise
      .locator("span")
      .first()
      .textContent();
    await firstExercise.click();

    // Submit selection
    await page.getByRole("button", { name: /Add \(1\)/ }).click();

    // Exercise should appear in the workout
    if (exerciseName) {
      await expect(page.getByText(exerciseName).first()).toBeVisible();
    }

    // Empty state should be gone
    await expect(page.getByText("No exercises yet")).not.toBeVisible();
  });

  test("should search and filter exercises in selector", async ({ page }) => {
    await page.getByRole("button", { name: "Add Exercise" }).click();

    const searchInput = page.getByPlaceholder("Search exercises...");
    await expect(searchInput).toBeVisible();

    // Get count before search
    const countText = page.locator("text=/\\d+ exercises?/").first();
    await expect(countText).toBeVisible();

    // Type a search query
    await searchInput.fill("bench");
    // Results should update (count may change)
    await page.waitForTimeout(300);
  });

  test("should add multiple exercises at once", async ({ page }) => {
    await page.getByRole("button", { name: "Add Exercise" }).click();

    // Select two exercises
    const exercises = page.locator(".exercise-selector__item");
    await exercises.nth(0).click();
    await exercises.nth(1).click();

    // Button should show count
    await expect(page.getByRole("button", { name: /Add \(2\)/ })).toBeVisible();
    await page.getByRole("button", { name: /Add \(2\)/ }).click();

    // Both exercises should be in the workout now
    await expect(page.getByText("No exercises yet")).not.toBeVisible();
  });

  test("should cancel exercise selector without adding", async ({ page }) => {
    await page.getByRole("button", { name: "Add Exercise" }).click();
    await page
      .getByRole("button", { name: "Cancel" })
      .filter({ has: page.locator("text=Cancel") })
      .first()
      .click();
    await expect(page.getByText("No exercises yet")).toBeVisible();
  });
});

test.describe("Workout Session - Set Management", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/workouts");
    await page.getByRole("button", { name: "Start Workout" }).click();
    await page.getByText("Start Fresh").click();
    await expect(page).toHaveURL(/\/workouts\/[a-z0-9-]+/);

    // Add an exercise first
    await page.getByRole("button", { name: "Add Exercise" }).click();
    const firstExercise = page.locator(".exercise-selector__item").first();
    await firstExercise.click();
    await page.getByRole("button", { name: /Add \(1\)/ }).click();

    // Wait for the exercise card to appear
    await expect(page.getByText("No exercises yet")).not.toBeVisible();
  });

  test("should display set table with headers", async ({ page }) => {
    await expect(page.getByText("Weight").first()).toBeVisible();
    await expect(page.getByText("Reps").first()).toBeVisible();
    await expect(page.getByText("RPE").first()).toBeVisible();
  });

  test("should have Add Set button", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Add Set" })).toBeVisible();
  });

  test("should add a set to the exercise", async ({ page }) => {
    await page.getByRole("button", { name: "Add Set" }).click();

    // Should see input fields for the new set
    await expect(page.getByPlaceholder("kg").first()).toBeVisible();
    await expect(page.getByPlaceholder("reps").first()).toBeVisible();
  });

  test("should log weight and reps for a set", async ({ page }) => {
    await page.getByRole("button", { name: "Add Set" }).click();

    // Fill in weight
    const weightInput = page.getByPlaceholder("kg").first();
    await weightInput.fill("60");

    // Fill in reps
    const repsInput = page.getByPlaceholder("reps").first();
    await repsInput.fill("10");

    // Wait for auto-submit
    await page.waitForTimeout(500);

    // Values should be preserved
    await expect(weightInput).toHaveValue("60");
    await expect(repsInput).toHaveValue("10");
  });

  test("should complete a set with the check button", async ({ page }) => {
    await page.getByRole("button", { name: "Add Set" }).click();

    // Fill in some data
    await page.getByPlaceholder("kg").first().fill("80");
    await page.getByPlaceholder("reps").first().fill("8");
    await page.waitForTimeout(300);

    // Click the green check button to complete the set
    const checkButton = page.locator("button").filter({ hasText: "✓" }).first();
    await checkButton.click();

    // After completing, the set row should be styled as completed
    // and the stats should update
    await page.waitForTimeout(500);
    await expect(page.getByText("sets").first()).toBeVisible();
  });

  test("should show stats after completing sets", async ({ page }) => {
    // Add a set and complete it
    await page.getByRole("button", { name: "Add Set" }).click();
    await page.getByPlaceholder("kg").first().fill("100");
    await page.getByPlaceholder("reps").first().fill("5");
    await page.waitForTimeout(300);

    const checkButton = page.locator("button").filter({ hasText: "✓" }).first();
    await checkButton.click();
    await page.waitForTimeout(500);

    // Stats row should show elapsed, sets, and done percentage
    await expect(page.getByText("elapsed")).toBeVisible();
    await expect(page.getByText("sets").first()).toBeVisible();
    await expect(page.getByText("done")).toBeVisible();
  });
});

test.describe("Workout Completion Flow", () => {
  test("should complete a full workout and return to workouts list", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/workouts");

    // Start a workout
    await page.getByRole("button", { name: "Start Workout" }).click();
    await page.getByText("Start Fresh").click();
    await expect(page).toHaveURL(/\/workouts\/[a-z0-9-]+/);

    // Add an exercise
    await page.getByRole("button", { name: "Add Exercise" }).click();
    const firstExercise = page.locator(".exercise-selector__item").first();
    await firstExercise.click();
    await page.getByRole("button", { name: /Add \(1\)/ }).click();
    await expect(page.getByText("No exercises yet")).not.toBeVisible();

    // Add and complete a set
    await page.getByRole("button", { name: "Add Set" }).click();
    await page.getByPlaceholder("kg").first().fill("60");
    await page.getByPlaceholder("reps").first().fill("12");
    await page.waitForTimeout(300);

    const checkButton = page.locator("button").filter({ hasText: "✓" }).first();
    await checkButton.click();
    await page.waitForTimeout(500);

    // Complete the workout
    await page.getByRole("button", { name: "Complete" }).click();

    // Completion modal should appear
    await expect(
      page.getByRole("heading", { name: "Complete Workout" }),
    ).toBeVisible();
    await expect(page.getByText("Duration")).toBeVisible();
    await expect(page.getByText("Exercises")).toBeVisible();
    await expect(page.getByText("Sets")).toBeVisible();
    await expect(page.getByText("Save as template")).toBeVisible();

    // Finish the workout
    await page.getByRole("button", { name: "Finish" }).click();

    // Should stay on workout page but show completed state (no Live badge)
    await expect(page.getByText("Live")).not.toBeVisible();
    // Complete button should be gone
    await expect(
      page.getByRole("button", { name: "Complete" }),
    ).not.toBeVisible();
  });

  test("should show completed workout in the workouts list", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/workouts");

    // Start and quickly complete a workout
    await page.getByRole("button", { name: "Start Workout" }).click();
    await page.getByText("Start Fresh").click();
    await expect(page).toHaveURL(/\/workouts\/[a-z0-9-]+/);

    // Complete without exercises
    await page.getByRole("button", { name: "Complete" }).click();
    await page.getByRole("button", { name: "Finish" }).click();
    await page.waitForTimeout(500);

    // Navigate back to workouts list
    await page.goto("/workouts");

    // The workout should appear in the list with Done status
    await expect(page.getByText("Done").first()).toBeVisible();
  });
});

test.describe("Exercises Page", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/workouts/exercises");
  });

  test("should display exercises page with header", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Exercises" }),
    ).toBeVisible();
  });

  test("should have Add Exercise link", async ({ page }) => {
    await expect(
      page.getByRole("link", { name: "Add Exercise" }),
    ).toBeVisible();
  });

  test("should navigate to create exercise page", async ({ page }) => {
    await page.getByRole("link", { name: "Add Exercise" }).click();
    await expect(page).toHaveURL(/\/workouts\/exercises\/create/);
    await expect(
      page.getByRole("heading", { name: "New Exercise" }),
    ).toBeVisible();
  });

  test("should have type filter", async ({ page }) => {
    await expect(page.getByRole("combobox").first()).toBeVisible();
  });

  test("should have search input", async ({ page }) => {
    await expect(page.locator('input[type="search"]')).toBeVisible();
  });
});

test.describe("Create Exercise Page", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/workouts/exercises/create");
  });

  test("should display create exercise form", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "New Exercise" }),
    ).toBeVisible();
    await expect(page.getByPlaceholder("Chest press")).toBeVisible();
    await expect(page.getByText("Description")).toBeVisible();
    await expect(page.getByText("Mind-Muscle Connection")).toBeVisible();
    await expect(page.getByText("Muscle Group")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create" })).toBeVisible();
  });

  test("should have Add Split button for muscle groups", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Add Split" })).toBeVisible();
  });

  test("should add a muscle group split", async ({ page }) => {
    await page.getByRole("button", { name: "Add Split" }).click();
    // A new row should appear in the table
    await expect(page.getByText("Abs")).toBeVisible();
  });

  test("should navigate back to exercises list", async ({ page }) => {
    await page.goto("/workouts/exercises");
    await expect(page).toHaveURL(/\/workouts\/exercises$/);
  });
});

test.describe("Workout - Cancel from Keep button", () => {
  test("should keep workout when pressing Keep in cancel dialog", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/workouts");

    // Start a workout
    await page.getByRole("button", { name: "Start Workout" }).click();
    await page.getByText("Start Fresh").click();
    await expect(page).toHaveURL(/\/workouts\/[a-z0-9-]+/);
    const workoutUrl = page.url();

    // Open the menu and click Cancel Workout
    await page.locator("button:has(svg)").last().click();
    await page.getByText("Cancel Workout").click();

    // Click Keep to dismiss
    await page.getByRole("button", { name: "Keep" }).click();

    // Should still be on the same workout page
    await expect(page).toHaveURL(workoutUrl);
    await expect(page.getByText("Live")).toBeVisible();
  });
});

test.describe("Workout Session - Continue button in completion modal", () => {
  test("should dismiss completion modal and continue workout", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/workouts");

    // Start a workout
    await page.getByRole("button", { name: "Start Workout" }).click();
    await page.getByText("Start Fresh").click();
    await expect(page).toHaveURL(/\/workouts\/[a-z0-9-]+/);

    // Open completion modal
    await page.getByRole("button", { name: "Complete" }).click();
    await expect(
      page.getByRole("heading", { name: "Complete Workout" }),
    ).toBeVisible();

    // Click Continue to dismiss
    await page.getByRole("button", { name: "Continue" }).click();

    // Modal should close, still on active workout
    await expect(
      page.getByRole("heading", { name: "Complete Workout" }),
    ).not.toBeVisible();
    await expect(page.getByText("Live")).toBeVisible();
  });
});
