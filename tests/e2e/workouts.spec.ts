import { expect, type Page, test } from "@playwright/test";

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
      page.getByRole("link", { name: "Import from Fitbod" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Manage Exercises" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Recovery Map" })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("link", { name: "Templates", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Generate Workout" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Import from Strong" }),
    ).toHaveCount(0);
  });

  test("should navigate to exercises page", async ({ page }) => {
    await page.getByRole("link", { name: "Manage Exercises" }).click();
    await expect(page).toHaveURL(/\/workouts\/exercises/);
    await expect(
      page.getByRole("heading", { name: "Exercises", exact: true }),
    ).toBeVisible();
  });

  test("retired feedback and recovery cannot run", async ({ page }) => {
    await expect(page.getByRole("button", { name: "AI Feedback" })).toHaveCount(
      0,
    );
    expect((await page.request.get("/workouts/recovery")).status()).toBe(404);
    expect(
      (await page.request.post("/workouts/recovery", { form: {} })).status(),
    ).toBe(404);
    expect(
      (
        await page.request.post("/workouts", {
          form: { intent: "get-ai-feedback" },
        })
      ).status(),
    ).toBe(400);
  });

  test("retired workout import rejects navigation and writes", async ({
    page,
  }) => {
    const response = await page.goto("/workouts/import");
    expect(response?.status()).toBe(404);
    expect((await page.request.get("/workouts/import")).status()).toBe(404);
    for (const importSource of ["fitbod", "strong"]) {
      expect(
        (
          await page.request.post("/workouts/import", {
            form: { importSource, csvContent: "retired import" },
          })
        ).status(),
      ).toBe(404);
    }
  });

  test("retired workout routes reject reads and writes", async ({ page }) => {
    for (const path of ["/workouts/templates", "/workouts/generate"]) {
      expect((await page.request.get(path)).status()).toBe(404);
      expect(
        (
          await page.request.post(path, { form: { intent: "generate" } })
        ).status(),
      ).toBe(404);
    }
  });
});

test.describe("Direct workout start", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("starts an empty usable session with one touch", async ({
    page,
  }, testInfo) => {
    await page.goto("/workouts");
    await expect(
      page.getByRole("button", { name: "Start Workout" }),
    ).toHaveAttribute("aria-keyshortcuts", "s");
    await page.getByRole("button", { name: "Start Workout" }).tap();
    await expect(page).toHaveURL(/\/workouts\/[a-z0-9-]+/);
    await expect(page.getByText("No exercises yet")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add Exercise" }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await testInfo.attach("mobile-fresh-workout", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  });

  test("does not start a workout while a dialog is open", async ({ page }) => {
    await page.goto("/workouts");
    await expect(
      page.getByRole("button", { name: "Start Workout" }),
    ).toHaveAttribute("aria-keyshortcuts", "s");
    await page.evaluate(() => {
      const dialog = document.createElement("div");
      dialog.setAttribute("role", "dialog");
      document.body.append(dialog);
    });
    await page.keyboard.press("s");
    await page.waitForTimeout(300);
    await expect(page).toHaveURL("/workouts");
    await page.evaluate(() =>
      document.querySelector('[role="dialog"]')?.remove(),
    );
    await page.keyboard.press("s");
    await expect(page).toHaveURL(/\/workouts\/[a-z0-9-]+/);
  });

  test("keeps the start shortcut", async ({ page }) => {
    await page.goto("/workouts");
    await expect(
      page.getByRole("button", { name: "Start Workout" }),
    ).toHaveAttribute("aria-keyshortcuts", "s");
    await page.keyboard.press("s");
    await expect(page).toHaveURL(/\/workouts\/[a-z0-9-]+/);
    await expect(page.getByText("No exercises yet")).toBeVisible();
  });
});

async function startWorkout(page: Page) {
  await page.goto("/workouts");
  await page.getByRole("button", { name: "Start Workout" }).click();
  await expect(page).toHaveURL(/\/workouts\/[a-z0-9-]+$/);
  await expect(page.getByText("Workout in progress")).toBeVisible();
}

/** Adds the first catalogue exercise and returns its name. */
async function addFirstExercise(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Add exercise" }).click();
  const option = page
    .getByRole("dialog", { name: "Add exercise" })
    .locator(".exercise-picker__option")
    .first();
  const name =
    (await option.locator(".exercise-picker__name").textContent()) ?? "";
  await option.click();
  await expect(page).toHaveURL(/\/exercises\/[a-z0-9-]+$/);
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  return name;
}

/** Resolves when the workout action has answered a matching submission. */
const workoutSaved = (page: Page, field = "") =>
  page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /\/workouts\/[a-z0-9-]+(\.data)?(\?.*)?$/.test(response.url()) &&
      (response.request().postData() ?? "").includes(field),
  );

async function enter(page: Page, label: string, value: string) {
  await page.getByRole("button", { name: new RegExp(`^${label}:`) }).click();
  const input = page.getByRole("textbox", { name: label });
  await input.fill(value);
  await input.press("Enter");
}

async function logSet(page: Page, label: string, reps: string, weight: string) {
  await enter(page, `${label} reps`, reps);
  await enter(page, `${label} weight`, weight);
  await page
    .getByRole("button", { name: `Complete ${label.toLowerCase()}` })
    .click();
}

const backToWorkout = (page: Page) =>
  page.getByRole("link", { name: "Workout", exact: true }).click();

test.describe("Active workout overview", () => {
  test.beforeEach(async ({ page }) => startWorkout(page));

  test("shows an empty workout that cannot be finished", async ({ page }) => {
    await expect(page.getByText("No exercises yet")).toBeVisible();
    await expect(page.getByRole("timer")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Finish workout", exact: true }),
    ).toHaveCount(0);
  });

  test("searches the exercise catalogue", async ({ page }) => {
    await page.getByRole("button", { name: "Add exercise" }).click();
    const sheet = page.getByRole("dialog", { name: "Add exercise" });
    await sheet
      .getByRole("searchbox", { name: "Search exercises" })
      .fill("zzzz");
    await expect(sheet.getByText("No exercises match")).toBeVisible();
    await sheet.getByRole("button", { name: "Close" }).click();
    await expect(sheet).not.toBeVisible();
  });

  test("renames the workout", async ({ page }) => {
    await page.getByRole("heading", { level: 1 }).getByRole("button").click();
    const input = page.getByRole("textbox", { name: "Workout name" });
    await input.fill("Upper A");
    const saved = workoutSaved(page, "intent=update-name");
    await input.press("Enter");
    await saved;
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Upper A", level: 1 }),
    ).toBeVisible();
  });

  test("redirects focused-exercise links to the exercise screen", async ({
    page,
  }) => {
    const name = await addFirstExercise(page);
    const exerciseUrl = page.url();
    const workoutPath = new URL(exerciseUrl).pathname.split("/exercises/")[0];
    const exerciseId = exerciseUrl.split("/exercises/")[1];
    await page.goto(`${workoutPath}?exercise=${exerciseId}`);
    await expect(page).toHaveURL(exerciseUrl);
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  });
});

test.describe("Exercise screen", () => {
  test.beforeEach(async ({ page }) => {
    await startWorkout(page);
    await addFirstExercise(page);
  });

  test("logs a set with RIR and keeps it after reload", async ({ page }) => {
    await page.getByRole("button", { name: "Add set" }).click();
    await expect(
      page.getByRole("button", { name: "Complete set 2" }),
    ).toBeVisible();

    await logSet(page, "Set 1", "8", "62.5");
    const rir = page.getByRole("dialog", { name: "Reps in reserve" });
    await expect(rir).toBeVisible();
    const saved = workoutSaved(page, "reportedRir=2");
    await rir.getByRole("button", { name: "2", exact: true }).click();
    await saved;
    await expect(rir).not.toBeVisible();
    await expect(
      page.getByRole("region", { name: "Rest timer" }),
    ).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole("button", { name: "Set 1 reps in reserve: 2" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Set 1 reps: 8" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Set 1 weight: 62.5" }),
    ).toBeVisible();
  });

  test("marks a set as a warm-up and removes a set", async ({ page }) => {
    await page.getByRole("button", { name: "Add set" }).click();
    await page
      .getByRole("button", { name: "Set 1. Tap to mark as warm-up" })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Warm-up set. Tap to make it a working set",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Complete set 1" }),
    ).toBeVisible();

    const saved = workoutSaved(page, "intent=remove-set");
    await page.getByRole("button", { name: "Remove set 1" }).click();
    await saved;
    await page.reload();
    await expect(
      page.getByRole("list", { name: "Sets" }).getByRole("listitem"),
    ).toHaveCount(1);
  });

  test("unticks a completed set and cancels its rest", async ({ page }) => {
    await page.getByRole("button", { name: "Add set" }).click();
    await logSet(page, "Set 1", "10", "40");
    await page
      .getByRole("dialog", { name: "Reps in reserve" })
      .getByRole("button", { name: "Not sure" })
      .click();
    await expect(
      page.getByRole("button", { name: "Set 1 reps in reserve: ?" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Complete set 1" }).click();
    await expect(
      page.getByRole("button", { name: "Remove set 1" }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Rest timer" })).toHaveCount(
      0,
    );
  });

  test("edits the mind-muscle cue more than once", async ({ page }) => {
    // The shared catalogue exercise may already carry a cue from other specs.
    await page
      .getByRole("button", { name: "Add mind-muscle cue" })
      .or(page.getByRole("button", { name: /Edit cue$/ }))
      .click();
    await page
      .getByLabel("Focus Cues & Instructions")
      .fill("Squeeze at the top");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page
      .getByRole("button", { name: /Squeeze at the top\. Edit cue/ })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(300);
    await expect(dialog).toBeVisible();
    await page.getByLabel("Focus Cues & Instructions").fill("Elbows down");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Elbows down", { exact: true })).toBeVisible();
  });

  test("removes the exercise after confirmation", async ({ page }) => {
    await page.getByRole("button", { name: "Remove exercise" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Remove exercise" })
      .click();
    await expect(page).toHaveURL(/\/workouts\/[a-z0-9-]+$/);
    await expect(page.getByText("No exercises yet")).toBeVisible();
  });

  test("returns to the overview with the exercise in progress", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Add set" }).click();
    await logSet(page, "Set 1", "8", "60");
    await page
      .getByRole("dialog", { name: "Reps in reserve" })
      .getByRole("button", { name: "1", exact: true })
      .click();
    await backToWorkout(page);
    await expect(page.getByRole("link", { name: /1 of 2 sets/ })).toBeVisible();
  });
});

test.describe("Reordering exercises", () => {
  test("drags an exercise to a new position", async ({ page }) => {
    await startWorkout(page);
    const first = await addFirstExercise(page);
    await backToWorkout(page);
    // A fresh catalogue may hold a single exercise, so create the second one.
    const second = `E2E Reorder Row ${Date.now()}`;
    const created = await page.request.post("/workouts/exercises/create", {
      form: { name: second, type: "cable", movementPattern: "pull" },
    });
    expect(created.ok()).toBeTruthy();
    await page.reload();
    await page.getByRole("button", { name: "Add exercise" }).click();
    const picker = page.getByRole("dialog", { name: "Add exercise" });
    await picker
      .getByRole("searchbox", { name: "Search exercises" })
      .fill(second);
    await picker.getByRole("button", { name: new RegExp(second) }).click();
    await expect(page).toHaveURL(/\/exercises\/[a-z0-9-]+$/);
    await backToWorkout(page);

    const grip = page.getByRole("button", { name: `Reorder ${first}` });
    const from = await grip.boundingBox();
    if (!from) throw new Error("Grip is not visible");
    const saved = workoutSaved(page, "reorder-exercises");
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    for (let step = 1; step <= 10; step++)
      await page.mouse.move(
        from.x + from.width / 2,
        from.y + from.height / 2 + step * 8,
      );
    await page.mouse.up();
    await saved;

    await page.reload();
    await expect(page.locator(".exercise-row__name").last()).toContainText(
      first,
    );
  });
});

test.describe("Finishing a workout", () => {
  test("warns about unfinished sets and keeps training on request", async ({
    page,
  }) => {
    await startWorkout(page);
    await addFirstExercise(page);
    await backToWorkout(page);

    await page.getByRole("button", { name: "Finish workout" }).click();
    const confirm = page.getByRole("dialog", { name: "Finish workout?" });
    await expect(confirm.getByText("1 set is not done yet")).toBeVisible();
    await confirm.getByRole("button", { name: "Keep training" }).click();
    await expect(confirm).not.toBeVisible();
    await expect(page.getByText("Workout in progress")).toBeVisible();

    await page.getByRole("button", { name: "Finish workout" }).click();
    await confirm.getByRole("button", { name: "Finish workout" }).click();
    const summary = page.getByRole("dialog", { name: "Workout complete" });
    await expect(summary.getByText("Duration")).toBeVisible();
    await summary.getByRole("button", { name: "Done" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("the final set asks to finish but only confirmation stops the workout", async ({
    page,
  }) => {
    await startWorkout(page);
    await addFirstExercise(page);
    await logSet(page, "Set 1", "5", "100");
    await page
      .getByRole("dialog", { name: "Reps in reserve" })
      .getByRole("button", { name: "0", exact: true })
      .click();
    const confirm = page.getByRole("dialog", { name: "Finish workout?" });
    await expect(confirm.getByText("Every set is done.")).toBeVisible();
    await confirm.getByRole("button", { name: "Keep training" }).click();
    await backToWorkout(page);
    await expect(page.getByText("Workout in progress")).toBeVisible();
  });

  test("a finished workout only allows correcting saved sets", async ({
    page,
  }) => {
    await startWorkout(page);
    const workoutPath = new URL(page.url()).pathname;
    const name = await addFirstExercise(page);
    await page.getByRole("button", { name: "Add set" }).click();
    await logSet(page, "Set 1", "8", "60");
    await page
      .getByRole("dialog", { name: "Reps in reserve" })
      .getByRole("button", { name: "2", exact: true })
      .click();
    await backToWorkout(page);
    await page.getByRole("button", { name: "Finish workout" }).click();
    await page
      .getByRole("dialog", { name: "Finish workout?" })
      .getByRole("button", { name: "Finish workout" })
      .click();
    await page
      .getByRole("dialog", { name: "Workout complete" })
      .getByRole("button", { name: "Done" })
      .click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto(workoutPath);

    await expect(page.getByText("Completed", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add exercise" }),
    ).toHaveCount(0);
    await page.getByRole("link", { name: new RegExp(`^Open ${name}`) }).click();
    await expect(
      page.getByRole("button", { name: /^Complete set/ }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add set" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Set 2 reps/ })).toHaveCount(
      0,
    );

    await enter(page, "Set 1 reps", "9");
    const saved = workoutSaved(page, "reportedRir=3");
    await page
      .getByRole("button", { name: "Set 1 reps in reserve: 2" })
      .click();
    await page
      .getByRole("dialog", { name: "Reps in reserve" })
      .getByRole("button", { name: "3", exact: true })
      .click();
    await saved;
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Set 1 reps: 9" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Set 1 reps in reserve: 3" }),
    ).toBeVisible();
  });
});

test.describe("Exercises Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/workouts/exercises");
  });

  test("should display exercises page with header", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Exercises", exact: true }),
    ).toBeVisible();
  });

  test("should have Add Exercise link", async ({ page }) => {
    await expect(
      page.getByRole("link", { name: "Add Exercise" }).first(),
    ).toBeVisible();
  });

  test("should navigate to create exercise page", async ({ page }) => {
    await page.getByRole("link", { name: "Add Exercise" }).first().click();
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
