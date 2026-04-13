import { expect, test } from "@playwright/test";

test.describe("Workouts Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/workouts");
  });

  test("should display workouts header", async ({ page }) => {
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
    await page.goto("/workouts");
  });

  test("should open dialog when clicking Start Workout", async ({ page }) => {
    await page.getByRole("button", { name: "Start Workout" }).click();
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
});

test.describe("Workout Session - Exercise Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/workouts");
    await page.getByRole("button", { name: "Start Workout" }).click();
    await page.getByText("Start Fresh").click();
    await expect(page).toHaveURL(/\/workouts\/[a-z0-9-]+/);
  });

  test("should add an exercise to the workout", async ({ page }) => {
    await page.getByRole("button", { name: "Add Exercise" }).click();

    const firstExercise = page.locator(".exercise-selector__item").first();
    await firstExercise.click();
    await page.getByRole("button", { name: /Add \(1\)/ }).click();

    await expect(page.getByText("No exercises yet")).not.toBeVisible();
  });

  test("should cancel exercise selector without adding", async ({ page }) => {
    await page.getByRole("button", { name: "Add Exercise" }).click();
    await expect(
      page.getByRole("heading", { name: "Add Exercises" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).last().click();
    await expect(page.getByText("No exercises yet")).toBeVisible();
  });
});

test.describe("Workout Session - Set Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/workouts");
    await page.getByRole("button", { name: "Start Workout" }).click();
    await page.getByText("Start Fresh").click();
    await expect(page).toHaveURL(/\/workouts\/[a-z0-9-]+/);

    // Add an exercise
    await page.getByRole("button", { name: "Add Exercise" }).click();
    await page.locator(".exercise-selector__item").first().click();
    await page.getByRole("button", { name: /Add \(1\)/ }).click();
    await expect(page.getByText("No exercises yet")).not.toBeVisible();
  });

  test("should display set table headers", async ({ page }) => {
    await page.getByRole("button", { name: "Add Set" }).click();
    await expect(page.getByText("Weight").first()).toBeVisible();
    await expect(page.getByText("Reps").first()).toBeVisible();
    await expect(page.getByText("RPE").first()).toBeVisible();
  });

  test("should add a set with input fields", async ({ page }) => {
    await page.getByRole("button", { name: "Add Set" }).click();
    await expect(page.getByPlaceholder("kg").first()).toBeVisible();
    await expect(page.getByPlaceholder("reps").first()).toBeVisible();
  });

  test("should log weight and reps", async ({ page }) => {
    await page.getByRole("button", { name: "Add Set" }).click();

    const weightInput = page.getByPlaceholder("kg").first();
    const repsInput = page.getByPlaceholder("reps").first();
    await weightInput.fill("60");
    await repsInput.fill("10");

    await expect(weightInput).toHaveValue("60");
    await expect(repsInput).toHaveValue("10");
  });

  test("should complete a set", async ({ page }) => {
    await page.getByRole("button", { name: "Add Set" }).click();
    await page.getByPlaceholder("kg").first().fill("80");
    await page.getByPlaceholder("reps").first().fill("8");

    const checkButton = page.locator("button").filter({ hasText: "✓" }).first();
    await checkButton.click();

    // Stats should appear after completing a set
    await expect(page.getByText("elapsed")).toBeVisible();
    await expect(page.getByText("done")).toBeVisible();
  });
});

test.describe("Workout Completion Flow", () => {
  test("should complete a workout with exercises", async ({ page }) => {
    await page.goto("/workouts");

    await page.getByRole("button", { name: "Start Workout" }).click();
    await page.getByText("Start Fresh").click();
    await expect(page).toHaveURL(/\/workouts\/[a-z0-9-]+/);

    // Add an exercise and a set
    await page.getByRole("button", { name: "Add Exercise" }).click();
    await page.locator(".exercise-selector__item").first().click();
    await page.getByRole("button", { name: /Add \(1\)/ }).click();
    await expect(page.getByText("No exercises yet")).not.toBeVisible();

    await page.getByRole("button", { name: "Add Set" }).click();
    await page.getByPlaceholder("kg").first().fill("60");
    await page.getByPlaceholder("reps").first().fill("12");

    // Complete the workout
    await page.getByRole("button", { name: "Complete" }).click();
    await expect(
      page.getByRole("heading", { name: "Complete Workout" }),
    ).toBeVisible();
    await expect(page.getByText("Duration")).toBeVisible();
    await expect(page.getByText("Save as template")).toBeVisible();

    await page.getByRole("button", { name: "Finish" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("should complete empty workout and show in list", async ({ page }) => {
    await page.goto("/workouts");

    await page.getByRole("button", { name: "Start Workout" }).click();
    await page.getByText("Start Fresh").click();
    await expect(page).toHaveURL(/\/workouts\/[a-z0-9-]+/);
    const workoutPath = new URL(page.url()).pathname;

    await page.getByRole("button", { name: "Complete" }).click();
    await page.getByRole("button", { name: "Finish" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/workouts");
    const workoutLink = page.locator(`a[href="${workoutPath}"]`);
    await expect(workoutLink).toBeVisible();
    await expect(workoutLink).toContainText("Done");
  });

  test("should dismiss completion modal with Continue", async ({ page }) => {
    await page.goto("/workouts");

    await page.getByRole("button", { name: "Start Workout" }).click();
    await page.getByText("Start Fresh").click();
    await expect(page).toHaveURL(/\/workouts\/[a-z0-9-]+/);

    await page.getByRole("button", { name: "Complete" }).click();
    await expect(
      page.getByRole("heading", { name: "Complete Workout" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(
      page.getByRole("heading", { name: "Complete Workout" }),
    ).not.toBeVisible();
    await expect(page.getByText("Live")).toBeVisible();
  });
});

test.describe("Workout Cancel Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/workouts");
    await page.getByRole("button", { name: "Start Workout" }).click();
    await page.getByText("Start Fresh").click();
    await expect(page).toHaveURL(/\/workouts\/[a-z0-9-]+/);
  });

  test("should cancel workout and redirect to list", async ({ page }) => {
    // Open dropdown menu (last icon button in header actions)
    await page.locator(".active-workout-header__actions button").last().click();
    await page.getByRole("menuitem", { name: "Cancel Workout" }).click();

    await expect(
      page.getByText("This will permanently delete all workout data"),
    ).toBeVisible();

    // Click the red Cancel button in the dialog
    await page.getByRole("button", { name: "Cancel" }).last().click();
    await expect(page).toHaveURL(/\/workouts$/);
  });

  test("should keep workout when pressing Keep", async ({ page }) => {
    const workoutUrl = page.url();

    await page.locator(".active-workout-header__actions button").last().click();
    await page.getByRole("menuitem", { name: "Cancel Workout" }).click();

    await page.getByRole("button", { name: "Keep" }).click();
    await expect(page).toHaveURL(workoutUrl);
    await expect(page.getByText("Live")).toBeVisible();
  });
});

test.describe("Exercises Page", () => {
  test.beforeEach(async ({ page }) => {
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
});

test.describe("Create Exercise Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/workouts/exercises/create");
  });

  test("should display create exercise form", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "New Exercise" }),
    ).toBeVisible();
    await expect(page.getByPlaceholder("Chest press")).toBeVisible();
    await expect(page.getByText("Description")).toBeVisible();
    await expect(page.getByText("Mind-Muscle Connection")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create" })).toBeVisible();
  });

  test("should add a muscle group split", async ({ page }) => {
    await page.getByRole("button", { name: "Add Split" }).click();
    await expect(page.locator('select[name="0-muscle-group"]')).toHaveValue(
      "abs",
    );
  });
});
