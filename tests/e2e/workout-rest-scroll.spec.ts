import { randomUUID } from "node:crypto";
import { test as base, expect, type Page } from "@playwright/test";
import pg from "pg";
import {
  canWriteFixtureDatabase,
  verifyFixtureServerDatabase,
} from "./support/fixture-database";

const test = base.extend<{ readonly sessionId: string }>({
  sessionId: async ({ request }, use) => {
    const pool = new pg.Pool({
      connectionString: process.env.E2E_DATABASE_URL,
    });
    const id = randomUUID();
    const exerciseIds = Array.from({ length: 6 }, () => randomUUID());
    try {
      await verifyFixtureServerDatabase(request, pool);
      await pool.query(
        "insert into workouts (id, name, start) values ($1, 'A long workout name that wraps across multiple lines on a phone', $2)",
        [id, new Date().toISOString()],
      );
      for (const [index, exerciseId] of exerciseIds.entries()) {
        await pool.query(
          "insert into exercises (id, name, type, movement_pattern) values ($1, $2, 'barbell', 'push')",
          [exerciseId, `Rest fixture exercise ${index + 1} ${exerciseId}`],
        );
        await pool.query(
          "insert into workout_exercises (workout_id, exercise_id, order_index) values ($1, $2, $3)",
          [id, exerciseId, index],
        );
        for (
          let set = 1;
          set <= (index === 0 ? 2 : index === 4 ? 22 : 4);
          set++
        ) {
          await pool.query(
            'insert into workout_sets (workout, exercise, set, reps, weight, "isCompleted") values ($1, $2, $3, 8, 60, false)',
            [id, exerciseId, set],
          );
        }
      }
      await use(id);
    } finally {
      await pool.query("delete from workout_sets where workout = $1", [id]);
      await pool.query("delete from workout_exercises where workout_id = $1", [
        id,
      ]);
      await pool.query("delete from workouts where id = $1", [id]);
      await pool.query("delete from exercises where id = any($1::uuid[])", [
        exerciseIds,
      ]);
      await pool.end();
    }
  },
});
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
test.skip(
  !canWriteFixtureDatabase(process.env.E2E_DATABASE_URL),
  "Requires a matching dedicated fixture database/server",
);

async function expectUncovered(page: Page, selector: string) {
  await expect
    .poll(() =>
      page.locator(selector).evaluate((element) => {
        const box = element.getBoundingClientRect();
        const chrome = document
          .querySelector(".active-workout-chrome")
          ?.getBoundingClientRect();
        const navigation = document
          .querySelector(".bottom-tabs")
          ?.getBoundingClientRect();
        const hit = document.elementFromPoint(
          box.x + box.width / 2,
          box.y + box.height / 2,
        );
        return (
          box.top >= (chrome?.bottom ?? 0) &&
          box.bottom <= (navigation?.top ?? innerHeight) &&
          (hit === element || element.contains(hit))
        );
      }),
    )
    .toBe(true);
}

test("manual Start counts down and rest controls remain usable", async ({
  page,
  sessionId,
}) => {
  await page.goto(`/workouts/${sessionId}`);
  await page
    .getByRole("link", { name: /^Open / })
    .first()
    .click();
  await expect(page.locator(".exercise-card--focused:visible")).toBeVisible();
  const focusedUrl = page.url();
  await page.clock.install({ time: new Date("2030-01-01T12:00:00Z") });
  await page.clock.pauseAt(new Date("2030-01-01T12:01:00Z"));
  const timer = page.getByRole("region", { name: "Rest timer" });
  const countdown = timer.getByRole("button", { name: "Choose rest duration" });
  await expect(countdown).toHaveText("1:30");
  await timer.getByRole("button", { name: "Start", exact: true }).click();
  await expect(countdown).toHaveText("1:30");
  await page.clock.runFor(1100);
  await expect(countdown).toHaveText("1:29");
  await timer.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(countdown).toHaveText("1:30");
  await countdown.click();
  await expect(timer.locator('[aria-keyshortcuts="2"]')).toContainText("1.5m");
  await timer.locator('[aria-keyshortcuts="2"]').click();
  await expect(countdown).toHaveText("1:30");
  await timer.locator('[aria-keyshortcuts="3"]').click();
  await expect(countdown).toHaveText("2:00");
  await timer.getByRole("button", { name: "Skip", exact: true }).click();
  await timer.getByRole("button", { name: "Start", exact: true }).click();
  await expect(countdown).toHaveText("2:00");
  await page.clock.runFor(120_000);
  await expect(countdown).toHaveText("0:00");
  await timer.getByRole("button", { name: "OK", exact: true }).click();
  await expect(
    timer.getByRole("button", { name: "Start", exact: true }),
  ).toBeVisible();
  await expect(countdown).toHaveText("2:00");
  expect(page.url()).toBe(focusedUrl);
});

test("rest stays visible and usable while scrolling, resizing and logging", async ({
  page,
  sessionId,
}) => {
  test.setTimeout(30_000);
  await page.goto(`/workouts/${sessionId}`);
  const focusedHref = await page
    .getByRole("link", { name: /^Open / })
    .nth(4)
    .getAttribute("href");
  expect(focusedHref).toBeTruthy();
  await page.goto(focusedHref!);
  await expect(page).toHaveURL(focusedHref!);
  await expect(page.locator(".exercise-card--focused:visible")).toBeVisible();
  await page.clock.install();
  const timer = page.getByRole("region", { name: "Rest timer" });
  let releaseSave = () => {};
  let notifySaving = () => {};
  const saveHeld = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  const savingStarted = new Promise<void>((resolve) => {
    notifySaving = resolve;
  });
  const actionUrl = `**/workouts/${sessionId}.data*`;
  await page.route(actionUrl, async (route) => {
    const request = route.request();
    if (
      request.method() === "POST" &&
      new URLSearchParams(request.postData() ?? "").get("isCompleted") ===
        "true"
    ) {
      notifySaving();
      await saveHeld;
    }
    await route.continue();
  });
  try {
    await page
      .getByRole("button", { name: "Complete set 1", exact: true })
      .first()
      .click();
    await savingStarted;
    await expect(
      timer.getByRole("button", { name: "Start", exact: true }),
    ).toBeVisible();
    await page.clock.runFor(2200);
    await expect(
      timer.getByRole("button", { name: "Start", exact: true }),
    ).toBeVisible();
  } finally {
    releaseSave();
  }
  await expect(
    timer.getByRole("button", { name: "Skip", exact: true }),
  ).toBeVisible();
  await page.unroute(actionUrl);
  const expectTimerPlacement = async () => {
    await expect
      .poll(() =>
        timer.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const header = document
            .querySelector(".active-workout-header")
            ?.getBoundingClientRect();
          return box.top >= (header?.bottom ?? 0) && box.bottom < innerHeight;
        }),
      )
      .toBe(true);
  };
  await expectTimerPlacement();
  for (const button of await timer.getByRole("button").all()) {
    const box = await button.boundingBox();
    // DOM geometry can have subpixel floating-point rounding.
    expect(box?.width).toBeGreaterThanOrEqual(44 - 0.001);
    expect(box?.height).toBeGreaterThanOrEqual(44 - 0.001);
  }
  const countdown = timer.locator(".rest-timer__countdown");
  await page.clock.runFor(1100);
  const beforeScroll = await countdown.textContent();
  const later = page.locator(".active-workout-exercise").nth(4);
  await later
    .getByRole("textbox", { name: "Set 20 weight", exact: true })
    .evaluate((element) => element.scrollIntoView({ block: "center" }));
  await expect
    .poll(() =>
      page.locator(".main-content").evaluate((element) => element.scrollTop),
    )
    .toBeGreaterThan(1000);
  await expect
    .poll(() =>
      timer.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return (
          box.top >= 0 &&
          box.bottom < innerHeight &&
          document
            .elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
            ?.closest(".rest-timer") === element
        );
      }),
    )
    .toBe(true);
  await page.clock.runFor(1100);
  expect(await countdown.textContent()).not.toBe(beforeScroll);
  await timer.getByRole("button", { name: "Choose rest duration" }).click();
  for (const [key, duration] of [
    ["1", "1:00"],
    ["2", "1:30"],
    ["3", "2:00"],
    ["4", "3:00"],
  ]) {
    await timer.locator(`[aria-keyshortcuts="${key}"]`).click();
    await expect(countdown).toHaveText(duration);
  }
  const input = later.getByRole("textbox", { name: "Set 2 weight" });
  await input.evaluate((element) =>
    element.scrollIntoView({ block: "center" }),
  );
  await input.fill("65");
  await expectUncovered(
    page,
    '.active-workout-exercise:nth-child(5) input[aria-label="Set 2 weight"]',
  );
  await page.setViewportSize({ width: 390, height: 500 });
  await expectTimerPlacement();
  await input.focus();
  await input.evaluate((element) =>
    element.scrollIntoView({ block: "center" }),
  );
  await expectUncovered(
    page,
    '.active-workout-exercise:nth-child(5) input[aria-label="Set 2 weight"]',
  );
  await input.press("3");
  await expect(countdown).toHaveText("3:00");
  await input.fill("65");
  await later
    .getByRole("button", { name: "Complete set 2", exact: true })
    .click();
  await expect(later.locator(".set-row--completed")).toHaveCount(2);
  await expect(countdown).toHaveText("3:00");
  await expect(
    later.getByText("How many more good reps could you have done?", {
      exact: true,
    }),
  ).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(timer).toBeVisible();
  await expectTimerPlacement();
  await expect
    .poll(() =>
      timer.evaluate(
        (element) => element.getBoundingClientRect().bottom < innerHeight,
      ),
    )
    .toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  const largerTitle = await page.addStyleTag({
    content: ".active-workout-header__name { font-size: 40px !important; }",
  });
  await expectTimerPlacement();
  await later
    .getByRole("textbox", { name: "Set 3 weight" })
    .evaluate((element) => element.scrollIntoView({ block: "center" }));
  await expectUncovered(
    page,
    '.active-workout-exercise:nth-child(5) input[aria-label="Set 3 weight"]',
  );
  await page.screenshot({ path: "/tmp/fitness-v3-390.png" });
  await page.setViewportSize({ width: 320, height: 844 });
  await expectTimerPlacement();
  await page.screenshot({ path: "/tmp/fitness-v3-320.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await largerTitle.evaluate((element) =>
    element.parentNode?.removeChild(element),
  );
  await expectTimerPlacement();
  await page.screenshot({ path: "/tmp/fitness-v3-normal.png" });
  await page
    .locator(".active-workout-header")
    .getByRole("button")
    .last()
    .click();
  await page
    .getByRole("menuitem", { name: "Cancel Workout", exact: true })
    .hover();
  await page.keyboard.press("Escape");
  await timer.locator('[aria-keyshortcuts="1"]').click();
  await page.clock.runFor(60_000);
  await expect(
    timer.getByRole("button", { name: "OK", exact: true }),
  ).toBeVisible();
  await timer.getByRole("button", { name: "OK", exact: true }).click();
  await expect(
    timer.getByRole("button", { name: "Start", exact: true }),
  ).toBeVisible();
  await later
    .getByRole("button", { name: "Complete set 3", exact: true })
    .click();
  await expect(timer).toBeVisible();
  await timer.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(
    timer.getByRole("button", { name: "Start", exact: true }),
  ).toBeVisible();
});

test("last-set completion and returning to the tab never scroll to another exercise", async ({
  page,
  sessionId,
}) => {
  await page.goto(`/workouts/${sessionId}`);
  const focusedHref = await page
    .getByRole("link", { name: /^Open / })
    .first()
    .getAttribute("href");
  expect(focusedHref).toBeTruthy();
  await page.goto(focusedHref!);
  await expect(page).toHaveURL(focusedHref!);
  await expect(page.locator(".exercise-card--focused:visible")).toBeVisible();
  await page.clock.install();
  const focusUrl = page.url();
  const first = page.locator(".active-workout-exercise").first();
  await first
    .getByRole("button", { name: "Complete set 1", exact: true })
    .click();
  await expect(first.locator(".set-row--completed")).toHaveCount(1);
  await first
    .getByRole("button", { name: "Report 2 good reps left for set 1" })
    .click();
  await expect(
    first.getByText("How many more good reps could you have done?"),
  ).toHaveCount(0);
  await page.clock.runFor(500);
  await first
    .getByRole("button", { name: "Complete set 2", exact: true })
    .evaluate((element) => element.scrollIntoView({ block: "center" }));
  const before = await page
    .locator(".main-content")
    .evaluate((element) => element.scrollTop);
  await page.evaluate(() => {
    const scrolls: string[] = [];
    Object.assign(window, { exerciseScrolls: scrolls });
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (...args) {
      if (this.hasAttribute("data-exercise-id"))
        scrolls.push(this.getAttribute("data-exercise-id") ?? "");
      return original.call(this, ...args);
    };
  });
  await first
    .getByRole("button", { name: "Complete set 2", exact: true })
    .click();
  await expect(first.locator(".set-row--completed")).toHaveCount(2);
  await page.clock.runFor(500);
  await expect(page).toHaveURL(focusUrl);
  expect(
    await page.evaluate(() => Reflect.get(window, "exerciseScrolls")),
  ).toEqual([]);
  expect(
    await page
      .locator(".main-content")
      .evaluate((element) => element.scrollTop),
  ).toBeCloseTo(before, 0);
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await page.clock.runFor(500);
  await expect(page).toHaveURL(focusUrl);
  expect(
    await page.evaluate(() => Reflect.get(window, "exerciseScrolls")),
  ).toEqual([]);
  expect(
    await page
      .locator(".main-content")
      .evaluate((element) => element.scrollTop),
  ).toBeCloseTo(before, 0);
});

test("cleared numeric drafts survive autosave and unrelated set updates", async ({
  page,
  sessionId,
}) => {
  await page.goto(`/workouts/${sessionId}`);
  await page
    .getByRole("link", { name: /^Open / })
    .first()
    .click();
  const weight = page.getByRole("textbox", {
    name: "Set 1 weight",
    exact: true,
  });
  const reps = page.getByRole("textbox", { name: "Set 1 reps", exact: true });
  const saveField = async (name: string, value: string) => {
    const saved = page.waitForResponse((response) => {
      return (
        response.request().method() === "POST" &&
        response.url().includes(`/workouts/${sessionId}`)
      );
    });
    await page
      .getByRole("textbox", { name: `Set 1 ${name}`, exact: true })
      .fill(value);
    await saved;
    await page.waitForLoadState("networkidle");
  };
  await saveField("weight", "35");
  await saveField("reps", "35");
  await weight.press("ControlOrMeta+ArrowRight");
  await weight.press("Backspace");
  await expect(weight).toHaveValue("3");
  await weight.press("Backspace");
  await expect(weight).toHaveValue("");
  await reps.press("ControlOrMeta+ArrowRight");
  await reps.press("Backspace");
  await expect(reps).toHaveValue("3");
  await reps.press("Backspace");
  await expect(reps).toHaveValue("");
  const toggled = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes(`/workouts/${sessionId}`),
  );
  await page.getByRole("button", { name: "Toggle warmup for set 1" }).click();
  await toggled;
  await expect(
    page.getByRole("button", { name: "Toggle warmup for set 1" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(weight).toHaveValue("");
  await expect(reps).toHaveValue("");
  await saveField("weight", "42.5");
  await saveField("reps", "12");
  await page
    .getByRole("button", { name: "Complete set 1", exact: true })
    .click();
  const saved = page
    .locator(".exercise-card--focused .set-row--warmup")
    .first();
  await expect(
    saved.getByRole("button", { name: "Edit set 1", exact: true }),
  ).toBeVisible();
  await expect(saved).toContainText("42.5");
  await expect(saved).toContainText("12");
  await page.reload();
  await expect(
    page.locator(".exercise-card--focused .set-row--warmup").first(),
  ).toContainText("42.5");
  await expect(
    page.locator(".exercise-card--focused .set-row--warmup").first(),
  ).toContainText("12");
});
