import { expect, type Page, test } from "@playwright/test";

interface HabitSuggestions {
  readonly habitName: string;
  readonly identityPhrases: readonly [string, string, string];
  readonly minimumVersionSuggestions: readonly [string, string, string];
}

async function mockHabitSuggestions(page: Page, suggestions: HabitSuggestions) {
  const [firstIdentity, secondIdentity, thirdIdentity] =
    suggestions.identityPhrases;
  const [firstMinimumVersion, secondMinimumVersion, thirdMinimumVersion] =
    suggestions.minimumVersionSuggestions;

  await page.route("**/habits/new.data", async (route) => {
    const request = route.request();
    if (
      request.method() !== "POST" ||
      !request.postData()?.includes("generate-identity-placeholder")
    ) {
      await route.continue();
      return;
    }

    await route.fulfill({
      contentType: "text/x-script",
      headers: { "X-Remix-Response": "yes" },
      body: JSON.stringify([
        { _1: 2 },
        "data",
        { _3: 4, _5: 6, _10: 11 },
        "habitName",
        suggestions.habitName,
        "identityPhrases",
        [7, 8, 9],
        firstIdentity,
        secondIdentity,
        thirdIdentity,
        "minimumVersionSuggestions",
        [12, 13, 14],
        firstMinimumVersion,
        secondMinimumVersion,
        thirdMinimumVersion,
      ]),
    });
  });
}

test.describe("Create Habit", () => {
  test.beforeEach(async ({ page }) => {
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

  test("back button navigates back to /habits from the first step", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Back" }).click();
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
    await expect(
      page.getByPlaceholder("Or write your own identity phrase"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Schedule →" }).click();

    await expect(page.getByText("Step 3 of 5")).toBeVisible();
    await expect(page.getByRole("button", { name: "daily" })).toBeVisible();
    await expect(page.getByRole("button", { name: "weekly" })).toBeVisible();
    await expect(page.getByRole("button", { name: "monthly" })).toBeVisible();
    await page.getByRole("button", { name: "Safety →" }).click();

    await expect(page.getByText("Step 4 of 5")).toBeVisible();
    await expect(
      page.getByPlaceholder("Or write your own minimum version"),
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

  test("tapping an identity suggestion uses it as the user's phrase", async ({
    page,
  }) => {
    const suggestion = "I am someone who practices presence.";

    await mockHabitSuggestions(page, {
      habitName: "Meditate",
      identityPhrases: [
        suggestion,
        "I am someone who tends to my inner calm.",
        "I am someone who roots myself in the present moment.",
      ],
      minimumVersionSuggestions: [
        "Take three slow breaths.",
        "Sit down and notice one breath.",
        "Set a one-minute timer and breathe.",
      ],
    });

    await page.getByPlaceholder("e.g. Morning Run").fill("Meditate");
    await page.getByRole("button", { name: "Identity →" }).click();
    await page
      .getByRole("button", { name: "Use this identity suggestion" })
      .click();

    await expect(
      page.getByPlaceholder("Or write your own identity phrase"),
    ).toHaveValue(suggestion);
  });

  test("cycles through identity suggestions", async ({ page }) => {
    const firstSuggestion = "I am someone who is calm.";
    const secondSuggestion = "I am someone who is focused.";

    await mockHabitSuggestions(page, {
      habitName: "Meditate",
      identityPhrases: [
        firstSuggestion,
        secondSuggestion,
        "I am someone who is patient.",
      ],
      minimumVersionSuggestions: [
        "Take three slow breaths.",
        "Sit down and notice one breath.",
        "Set a one-minute timer and breathe.",
      ],
    });

    await page.getByPlaceholder("e.g. Morning Run").fill("Meditate");
    await page.getByRole("button", { name: "Identity →" }).click();
    const suggestionButton = page.getByRole("button", {
      name: "Use this identity suggestion",
    });

    await expect(suggestionButton).toContainText(firstSuggestion);
    await expect(suggestionButton).toContainText(secondSuggestion, {
      timeout: 5_000,
    });
  });

  test("tapping a minimum version suggestion uses it as the user's safety net", async ({
    page,
  }) => {
    const suggestion = "Take three slow breaths.";

    await mockHabitSuggestions(page, {
      habitName: "Meditate",
      identityPhrases: [
        "I am someone who practices presence.",
        "I am someone who tends to my inner calm.",
        "I am someone who roots myself in the present moment.",
      ],
      minimumVersionSuggestions: [
        suggestion,
        "Sit down and notice one breath.",
        "Set a one-minute timer and breathe.",
      ],
    });

    await page.getByPlaceholder("e.g. Morning Run").fill("Meditate");
    await page.getByRole("button", { name: "Identity →" }).click();
    await page.getByRole("button", { name: "Schedule →" }).click();
    await page.getByRole("button", { name: "Safety →" }).click();
    await page
      .getByRole("button", {
        name: `Use minimum version suggestion: ${suggestion}`,
      })
      .click();

    await expect(
      page.getByPlaceholder("Or write your own minimum version"),
    ).toHaveValue(suggestion);
  });

  test("Enter accepts the active identity suggestion", async ({ page }) => {
    const suggestion = "I am someone who practices presence.";

    await mockHabitSuggestions(page, {
      habitName: "Meditate",
      identityPhrases: [
        suggestion,
        "I am someone who tends to my inner calm.",
        "I am someone who roots myself in the present moment.",
      ],
      minimumVersionSuggestions: [
        "Take three slow breaths.",
        "Sit down and notice one breath.",
        "Set a one-minute timer and breathe.",
      ],
    });

    await page.getByPlaceholder("e.g. Morning Run").fill("Meditate");
    await page.getByRole("button", { name: "Identity →" }).click();
    await expect(
      page.getByRole("button", { name: "Use this identity suggestion" }),
    ).toBeVisible();
    await page
      .getByPlaceholder("Or write your own identity phrase")
      .press("Enter");

    await expect(
      page.getByPlaceholder("Or write your own identity phrase"),
    ).toHaveValue(suggestion);
  });

  test("Enter accepts the active minimum version suggestion", async ({
    page,
  }) => {
    const suggestion = "Take three slow breaths.";

    await mockHabitSuggestions(page, {
      habitName: "Meditate",
      identityPhrases: [
        "I am someone who practices presence.",
        "I am someone who tends to my inner calm.",
        "I am someone who roots myself in the present moment.",
      ],
      minimumVersionSuggestions: [
        suggestion,
        "Sit down and notice one breath.",
        "Set a one-minute timer and breathe.",
      ],
    });

    await page.getByPlaceholder("e.g. Morning Run").fill("Meditate");
    await page.getByRole("button", { name: "Identity →" }).click();
    await page.getByRole("button", { name: "Schedule →" }).click();
    await page.getByRole("button", { name: "Safety →" }).click();
    await expect(
      page.getByRole("button", {
        name: `Use minimum version suggestion: ${suggestion}`,
      }),
    ).toBeVisible();
    await page
      .getByPlaceholder("Or write your own minimum version")
      .press("Enter");

    await expect(
      page.getByPlaceholder("Or write your own minimum version"),
    ).toHaveValue(suggestion);
  });
});

test.describe("Weekly Habits", () => {
  test.beforeEach(async ({ page }) => {
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
      (element) => window.getComputedStyle(element).backgroundColor,
    );
    expect(bg).toBe("rgb(225, 90, 70)");
  });
});
