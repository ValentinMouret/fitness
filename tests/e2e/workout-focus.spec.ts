import { randomUUID } from "node:crypto";
import { test as base, expect } from "@playwright/test";
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
    const exerciseIds = Array.from({ length: 2 }, () => randomUUID());
    try {
      await verifyFixtureServerDatabase(request, pool);
      await pool.query(
        "insert into workouts (id, name, start) values ($1, 'Focus acceptance workout', $2)",
        [id, new Date().toISOString()],
      );
      for (const [index, exerciseId] of exerciseIds.entries()) {
        await pool.query(
          "insert into exercises (id, name, type, movement_pattern) values ($1, $2, 'barbell', 'push')",
          [exerciseId, `Focus fixture exercise ${index + 1} ${exerciseId}`],
        );
        await pool.query(
          "insert into workout_exercises (workout_id, exercise_id, order_index) values ($1, $2, $3)",
          [id, exerciseId, index],
        );
        for (let set = 1; set <= (index === 0 ? 8 : 2); set++) {
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

for (const viewport of [
  { width: 320, height: 844 },
  { width: 390, height: 844 },
  { width: 740, height: 390 },
]) {
  test(`workout chrome spans mobile edges at ${viewport.width}px`, async ({
    page,
    sessionId,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto(`/workouts/${sessionId}`);
    await expect
      .poll(() =>
        page
          .locator(".page-transition")
          .evaluate((element) => getComputedStyle(element).opacity),
      )
      .toBe("1");
    const checkEdges = async () => {
      for (const selector of [".active-workout-header", ".rest-timer"]) {
        const box = await page.locator(selector).boundingBox();
        if (!box) throw new Error(`Missing ${selector}`);
        expect(Math.abs(box.x)).toBeLessThan(1);
        expect(Math.abs(box.x + box.width - viewport.width)).toBeLessThan(1);
      }
      const content = await page
        .locator(".active-workout-content")
        .boundingBox();
      if (!content) throw new Error("Missing exercise content");
      expect(content.x).toBeGreaterThan(0);
      expect(content.x + content.width).toBeLessThan(viewport.width);
      expect(
        await page
          .locator(".main-content")
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
      ).toBe(true);
      const timerPadding = await page
        .locator(".rest-timer__body")
        .evaluate((element) => getComputedStyle(element).paddingLeft);
      expect(timerPadding).toBe(viewport.width <= 340 ? "16px" : "20px");
    };
    await checkEdges();
    await page
      .getByRole("link", { name: /^Open Focus fixture exercise/ })
      .first()
      .click();
    await checkEdges();
    await page
      .getByRole("region", { name: "Rest timer" })
      .getByRole("button", { name: "Start", exact: true })
      .click();
    await expect(page.locator(".rest-timer__label")).toHaveText("Rest");
    await checkEdges();
    const scroller = page.locator(".main-content");
    await scroller.evaluate((element) => {
      element.scrollTop = 120;
    });
    await expect
      .poll(() => scroller.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(30);
    const chrome = await page.locator(".active-workout-chrome").boundingBox();
    if (!chrome) throw new Error("Missing workout chrome");
    expect(Math.abs(chrome.y)).toBeLessThan(1);
    await checkEdges();
    await page.screenshot({
      path: `/tmp/workout-chrome-${viewport.width}.png`,
    });
    await page.getByRole("link", { name: "Overview", exact: true }).click();
    await checkEdges();
    await expect(page.locator(".rest-timer__label")).toHaveText("Rest");
  });
}

test("manual navigation retains drafts, timer and history scroll on a phone", async ({
  page,
  sessionId,
}) => {
  test.setTimeout(30_000);
  await page.goto(`/workouts/${sessionId}`);
  const links = page.getByRole("link", {
    name: /^Open Focus fixture exercise/,
  });
  const firstHref = await links.first().getAttribute("href");
  await links.first().click();
  await expect(page).toHaveURL(firstHref!);
  await expect(
    page.getByText("0 of 8 sets saved", { exact: true }),
  ).toBeVisible();
  const weight = page.getByRole("textbox", {
    name: "Set 1 weight",
    exact: true,
  });
  await weight.fill("52.5");
  await expect(weight).toHaveValue("52.5");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.locator(".main-content").evaluate((element) => {
    element.scrollTop = 200;
  });
  await expect
    .poll(() =>
      page.locator(".main-content").evaluate((element) => element.scrollTop),
    )
    .toBeGreaterThan(100);
  const scroll = await page
    .locator(".main-content")
    .evaluate((element) => element.scrollTop);
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page).toHaveURL(`/workouts/${sessionId}`);
  await page.goBack();
  await expect(page).toHaveURL(firstHref!);
  await expect
    .poll(() =>
      page.locator(".main-content").evaluate((element) => element.scrollTop),
    )
    .toBeCloseTo(scroll, 0);
  await expect(weight).toHaveValue("52.5");
  await expect(
    page.getByRole("button", { name: "Skip", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Next" }).click();
  await expect(
    page.getByText("0 of 2 sets saved", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("finishing unfinished sets requires confirmation and retains planned rows", async ({
  page,
  sessionId,
}) => {
  await page.goto(`/workouts/${sessionId}`);
  await page
    .getByRole("button", { name: "Finish workout", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("10 sets are unfinished");
  await dialog
    .getByRole("button", { name: "Keep training", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("button", { name: "Finish workout", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Finish anyway", exact: true })
    .click();
  await expect(page).toHaveURL(/dashboard/);
  const pool = new pg.Pool({ connectionString: process.env.E2E_DATABASE_URL });
  try {
    const rows = await pool.query(
      'select w.stop, count(s.*)::int as planned, count(s.*) filter (where s."isCompleted")::int as completed from workouts w join workout_sets s on s.workout = w.id where w.id = $1 group by w.stop',
      [sessionId],
    );
    expect(rows.rows[0].stop).not.toBeNull();
    expect(rows.rows[0].planned).toBe(10);
    expect(rows.rows[0].completed).toBe(0);
  } finally {
    await pool.end();
  }
});

test("final-save readiness spans every exercise and correction retains historical effort", async ({
  page,
  sessionId,
}) => {
  test.setTimeout(30_000);
  const pool = new pg.Pool({ connectionString: process.env.E2E_DATABASE_URL });
  try {
    const exercises = await pool.query(
      "select exercise_id from workout_exercises where workout_id = $1 order by order_index",
      [sessionId],
    );
    const firstId: string = exercises.rows[0].exercise_id;
    const lastId: string = exercises.rows[1].exercise_id;
    await pool.query(
      'update workout_sets set "isCompleted" = true where workout = $1',
      [sessionId],
    );
    await pool.query(
      'update workout_sets set "isCompleted" = false, rpe = 8 where workout = $1 and exercise = $2 and set = 8',
      [sessionId, firstId],
    );
    await page.goto(`/workouts/${sessionId}?exercise=${lastId}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByText("2 of 2 sets saved", { exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Previous" }).click();
    await expect(page).toHaveURL(`/workouts/${sessionId}?exercise=${firstId}`);
    await expect(
      page.getByText("7 of 8 sets saved", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Complete set 8", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("All sets are saved");
    expect(
      (await pool.query("select stop from workouts where id = $1", [sessionId]))
        .rows[0].stop,
    ).toBeNull();
    await dialog
      .getByRole("button", { name: "Keep training", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Report 2 good reps left for set 8",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Edit set 8 reported effort",
        exact: true,
      }),
    ).toHaveText("~2 left");
    await page.getByRole("button", { name: "Edit set 8", exact: true }).click();
    await expect(
      page.getByRole("combobox", { name: "Set 8 reported effort" }),
    ).toHaveCount(0);
    await page
      .getByRole("textbox", { name: "Set 8 weight", exact: true })
      .fill("62.5");
    await page
      .getByRole("textbox", { name: "Set 8 reps", exact: true })
      .fill("9");
    const row = page
      .locator(".active-workout-exercise")
      .first()
      .locator(".set-row")
      .nth(7);
    await row.getByRole("button", { name: "Save", exact: true }).click();
    await expect(row.getByText("62.5", { exact: true })).toBeVisible();
    await expect(dialog).toHaveCount(0);
    const saved = await pool.query(
      'select weight, reps, rpe, reported_rir, "isCompleted" from workout_sets where workout = $1 and exercise = $2 and set = 8',
      [sessionId, firstId],
    );
    expect(saved.rows[0]).toMatchObject({
      weight: 62.5,
      reps: 9,
      rpe: 8,
      reported_rir: "2",
      isCompleted: true,
    });
    await page.getByRole("button", { name: "Add Set", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Complete set 9", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Overview", exact: true }).click();
    await page
      .getByRole("button", { name: "Finish workout", exact: true })
      .click();
    await expect(dialog).toContainText("1 set is unfinished");
  } finally {
    await pool.end();
  }
});

test("completed sessions use read-only overview and focus without changing history", async ({
  page,
  sessionId,
}) => {
  const pool = new pg.Pool({ connectionString: process.env.E2E_DATABASE_URL });
  const snapshot = async () =>
    (
      await pool.query(
        `select
    (select to_jsonb(w) from workouts w where id = $1) as workout,
    (select jsonb_agg(to_jsonb(e) order by order_index) from workout_exercises e where workout_id = $1) as exercises,
    (select jsonb_agg(to_jsonb(s) order by exercise, set) from workout_sets s where workout = $1) as sets`,
        [sessionId],
      )
    ).rows;
  try {
    await pool.query(
      "update workouts set start = '2024-01-02 10:00:00', stop = '2024-01-02 10:35:00', notes = 'Retained history' where id = $1",
      [sessionId],
    );
    await pool.query(
      'update workout_sets set "isCompleted" = (set <> 2), reported_rir = case when set <> 2 then $2 else null end, rpe = 8 where workout = $1',
      [sessionId, "2"],
    );
    const before = await snapshot();
    let mutationCount = 0;
    page.on("request", (request) => {
      if (request.method() !== "GET") mutationCount++;
    });
    await page.goto(`/workouts/${sessionId}`);
    await expect(
      page.getByText("Completed · 35m", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/Started .*ago/)).toHaveCount(0);
    const links = page.getByRole("link", {
      name: /^Open Focus fixture exercise/,
    });
    await expect(links).toHaveCount(2);
    const firstHref = await links.first().getAttribute("href");
    await links.first().click();
    await expect(page).toHaveURL(firstHref!);
    await expect(
      page.getByText("7 of 8 sets saved", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: /Complete set|Remove set|Add Set|Add Exercise|Finish workout|Reorder|reported effort/,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByText("~2 left", { exact: true }).filter({ visible: true }),
    ).toHaveCount(7);
    await expect(
      page
        .getByText("RPE 8 (legacy)", { exact: true })
        .filter({ visible: true }),
    ).toHaveCount(8);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(firstHref!);
    const next = page.getByRole("link", { name: "Next" });
    const nextHref = await next.getAttribute("href");
    if (!nextHref) throw new Error("Next exercise link requires a destination");
    await next.click();
    await expect(page).toHaveURL(nextHref);
    await expect(
      page.getByText("1 of 2 sets saved", { exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Previous" }).click();
    await expect(page).toHaveURL(firstHref!);
    await page.getByRole("link", { name: "Overview", exact: true }).click();
    await expect(links).toHaveCount(2);
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Rest timer" })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", {
        name: /Complete set|Remove set|Add Set|Add Exercise|Finish workout|Reorder|reported effort/,
      }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Workout actions", exact: true })
      .click();
    await expect(page.getByRole("menuitem", { name: /Repeat/ })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Delete/ })).toBeVisible();
    await page.keyboard.press("Escape");
    expect(mutationCount).toBe(0);
    expect(await snapshot()).toEqual(before);
    await page.setViewportSize({ width: 320, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await pool.end();
  }
});
