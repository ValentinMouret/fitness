import { randomUUID } from "node:crypto";
import { test as base, expect, type Locator } from "@playwright/test";
import pg from "pg";
import {
  canWriteFixtureDatabase,
  verifyFixtureServerDatabase,
} from "./support/fixture-database";

const test = base.extend<{ readonly pool: pg.Pool }>({
  pool: async ({ request }, use) => {
    const pool = new pg.Pool({
      connectionString: process.env.E2E_DATABASE_URL,
    });
    try {
      await verifyFixtureServerDatabase(request, pool);
      await use(pool);
    } finally {
      await pool.end();
    }
  },
});
async function expectTouchTarget(control: Locator) {
  const box = await control.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
}
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
test.skip(
  !canWriteFixtureDatabase(process.env.E2E_DATABASE_URL),
  "Requires a matching dedicated fixture database/server",
);

test("weight correction keeps both original timestamps and dated entry remains available", async ({
  page,
  pool,
}) => {
  const offset = Math.floor(Math.random() * 6 * 60 * 60 * 1000);
  const first = new Date(Date.UTC(1901, 2, 1, 12) + offset).toISOString();
  const second = new Date(Date.parse(first) + 60_000).toISOString();
  const addedDate = new Date(
    Date.UTC(1800, 0, 1) + Math.floor(Math.random() * 36500) * 86400000,
  )
    .toISOString()
    .slice(0, 10);
  const added = `${addedDate}T00:00:00.000Z`;
  const existing = await pool.query(
    "select 1 from measures where measurement_name = 'weight' and t = $1",
    [added],
  );
  expect(existing.rowCount).toBe(0);
  const originalValue = Number((83 + Math.random()).toFixed(6));
  try {
    await pool.query(
      "insert into measures (measurement_name, t, value) values ('weight', $1, $3), ('weight', $2, 82.456)",
      [first, second, originalValue],
    );
    await page.goto("/dashboard");
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Meas." }),
    ).toHaveCount(0);
    await expectTouchTarget(
      page.getByRole("link", { name: "History & corrections" }),
    );
    await page.getByRole("link", { name: "History & corrections" }).click();
    const row = page
      .getByRole("row")
      .filter({ hasText: `${originalValue} kg` });
    await expectTouchTarget(row.getByRole("button", { name: "Correct value" }));
    await row.getByRole("button", { name: "Correct value" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator('input[name="date"]')).toHaveValue(first);
    await dialog
      .getByRole("textbox", { name: "Corrected weight" })
      .fill("81.123");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Correct value" }).click();
    await dialog.getByRole("textbox", { name: "Corrected weight" }).fill("-1");
    await dialog.getByRole("button", { name: "Save correction" }).click();
    await expect(dialog.getByText("Invalid value")).toBeVisible();
    await dialog
      .getByRole("textbox", { name: "Corrected weight" })
      .fill("81.123");
    await dialog.getByRole("button", { name: "Save correction" }).click();
    await expect(dialog).toHaveCount(0);
    await page.reload();
    const result = await pool.query<{ t: Date; value: number }>(
      "select t, value from measures where measurement_name = 'weight' and t = any($1::timestamp[]) order by t",
      [[first, second]],
    );
    expect(
      result.rows.map((record) => ({
        t: record.t.toISOString(),
        value: record.value,
      })),
    ).toEqual([
      { t: first, value: 81.123 },
      { t: second, value: 82.456 },
    ]);
    await page.getByLabel("Value (kg)", { exact: true }).fill("80");
    await page.getByLabel("Date", { exact: true }).fill(addedDate);
    await page
      .getByRole("button", { name: "Add Measurement", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (
            await pool.query(
              "select value from measures where measurement_name = 'weight' and t = $1",
              [added],
            )
          ).rows[0]?.value,
      )
      .toBe(80);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
  } finally {
    await pool.query(
      "delete from measures where measurement_name = 'weight' and t = any($1::timestamp[])",
      [[first, second, added]],
    );
  }
});

test("Dashboard weight stays directly loggable after a same-day reading and repeated saves", async ({
  page,
  pool,
}) => {
  const originalTimestamp = new Date().toISOString();
  const originalValue = Number((85 + Math.random()).toFixed(6));
  const firstValue = Number((86 + Math.random()).toFixed(6));
  const secondValue = Number((87 + Math.random()).toFixed(6));
  const existing = await pool.query(
    "select 1 from measures where measurement_name='weight' and (t=$1 or value=any($2::float8[]))",
    [originalTimestamp, [firstValue, secondValue]],
  );
  expect(existing.rowCount).toBe(0);
  try {
    await pool.query(
      "insert into measures(measurement_name,t,value) values('weight',$1,$2)",
      [originalTimestamp, originalValue],
    );
    await page.goto("/dashboard");
    const input = page.getByRole("textbox", { name: "Weight", exact: true });
    const log = page.getByRole("button", { name: "Log", exact: true });
    await expect(input).toBeVisible();
    await expectTouchTarget(log);
    for (const value of [firstValue, secondValue]) {
      await input.fill(String(value));
      await log.click();
      await expect
        .poll(
          async () =>
            (
              await pool.query(
                "select count(*)::int as count from measures where measurement_name='weight' and value=$1",
                [value],
              )
            ).rows[0].count,
        )
        .toBe(1);
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(input).toBeVisible();
      await expect(log).toBeEnabled();
    }
    expect(
      (
        await pool.query(
          "select value from measures where measurement_name='weight' and t=$1",
          [originalTimestamp],
        )
      ).rows[0].value,
    ).toBe(originalValue);
    await expect(
      page.getByRole("link", { name: "History & corrections" }),
    ).toBeVisible();
  } finally {
    await pool.query(
      "delete from measures where measurement_name='weight' and (t=$1 or value=any($2::float8[]))",
      [originalTimestamp, [firstValue, secondValue]],
    );
  }
});

test("nutrition opens the saved calorie target and existing calculator", async ({
  page,
  pool,
}) => {
  const id = randomUUID();
  const current = await pool.query(
    "select value from targets where measurement_name = 'daily_calorie_intake' and deleted_at is null",
  );
  const ownTarget = current.rowCount === 0;
  try {
    if (ownTarget)
      await pool.query(
        "insert into targets (id, measurement_name, value) values ($1, 'daily_calorie_intake', 2300)",
        [id],
      );
    const value = ownTarget ? 2300 : current.rows[0].value;
    await page.goto("/nutrition");
    await expectTouchTarget(
      page.getByRole("button", { name: "Calorie target", exact: true }),
    );
    await page
      .getByRole("button", { name: "Calorie target", exact: true })
      .click();
    await expect(
      page
        .getByRole("dialog")
        .getByText(`${value} kcal per day`, { exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Recalculate target" }).click();
    await expect(page).toHaveURL(/\/nutrition\/calculate-targets$/);
    await expect(
      page.getByRole("heading", { name: "Calculate Targets" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      "/nutrition",
    );
  } finally {
    if (ownTarget) await pool.query("delete from targets where id = $1", [id]);
  }
});

test("catalogue correction preserves caller context, identity, sets and MMC", async ({
  page,
  pool,
}) => {
  test.setTimeout(45_000);
  const workoutId = randomUUID();
  const firstId = randomUUID();
  const secondId = randomUUID();
  const firstName = `Row first ${firstId}`;
  const secondName = `Row second ${secondId}`;
  const correctedName = `Row corrected ${firstId}`;
  const cue = `Pull elbows back ${firstId}`;
  try {
    await pool.query(
      "insert into exercises (id, name, type, movement_pattern, mmc_instructions) values ($1, $2, 'cable', 'pull', $3), ($4, $5, 'cable', 'pull', null)",
      [firstId, firstName, cue, secondId, secondName],
    );
    await pool.query(
      "insert into exercise_muscle_groups (exercise, muscle_group, split) values ($1, 'lats', 100), ($2, 'lats', 100)",
      [firstId, secondId],
    );
    await pool.query(
      "insert into workouts (id, name, start) values ($1, 'Prototype caller context', now())",
      [workoutId],
    );
    await pool.query(
      "insert into workout_exercises (workout_id, exercise_id, order_index) values ($1, $2, 0)",
      [workoutId, firstId],
    );
    await pool.query(
      'insert into workout_sets (workout, exercise, set, reps, weight, "isCompleted") values ($1, $2, 1, 8, 60, true)',
      [workoutId, firstId],
    );
    await page.goto(`/workouts/${workoutId}`);
    await page
      .getByRole("button", { name: "Add Exercise", exact: true })
      .click();
    const picker = page.getByRole("dialog");
    await picker.getByPlaceholder("Search exercises...").fill("Row");
    await picker.getByText(secondName, { exact: true }).click();
    await expect(
      picker.getByRole("button", { name: "Add (1)", exact: true }),
    ).toBeEnabled();
    const correction = picker.getByRole("link", {
      name: `Correct catalogue details for ${firstName}`,
      exact: true,
    });
    await expectTouchTarget(correction);
    await correction.click();
    await expect(page).toHaveURL(new RegExp(`/exercises/${firstId}/edit`));
    await page.goBack();
    await expect(picker).toBeVisible();
    await expect(picker.getByPlaceholder("Search exercises...")).toHaveValue(
      "Row",
    );
    await expect(
      picker.getByRole("button", { name: "Add (1)", exact: true }),
    ).toBeEnabled();
    await correction.click();
    await page.getByRole("link", { name: "Cancel correction" }).click();
    await expect(picker).toBeVisible();
    await expect(
      picker.getByRole("button", { name: "Add (1)", exact: true }),
    ).toBeEnabled();
    await correction.click();
    await expect(
      page.getByText(/Catalogue changes apply to every workout/),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Movement pattern" }),
    ).toHaveText("Pull");
    await page.getByLabel("Name", { exact: false }).fill(correctedName);
    const split = page.locator('input[name="0-split"]');
    await split.fill("50");
    await page.getByRole("button", { name: "Update Exercise" }).click();
    await expect(
      page.getByText("Muscle percentages must total 100."),
    ).toBeVisible();
    await expect(page.getByLabel("Name", { exact: false })).toHaveValue(
      correctedName,
    );
    await split.fill("100");
    await page.getByLabel("Name", { exact: false }).fill(secondName);
    await page.getByRole("button", { name: "Update Exercise" }).click();
    await expect(page.getByText(/Could not save the correction/)).toBeVisible();
    await expect(page.getByLabel("Name", { exact: false })).toHaveValue(
      secondName,
    );
    await page.getByLabel("Name", { exact: false }).fill(correctedName);
    await page.getByRole("button", { name: "Update Exercise" }).click();
    await expect(picker).toBeVisible();
    await expect(picker.getByPlaceholder("Search exercises...")).toHaveValue(
      "Row",
    );
    await expect(
      picker.getByRole("button", { name: "Add (1)", exact: true }),
    ).toBeEnabled();
    expect(
      (
        await pool.query(
          "select id, name, movement_pattern, mmc_instructions from exercises where id = $1",
          [firstId],
        )
      ).rows[0],
    ).toMatchObject({
      id: firstId,
      name: correctedName,
      movement_pattern: "pull",
      mmc_instructions: cue,
    });
    expect(
      (
        await pool.query(
          'select exercise, reps, weight, "isCompleted" from workout_sets where workout = $1',
          [workoutId],
        )
      ).rows,
    ).toEqual([{ exercise: firstId, reps: 8, weight: 60, isCompleted: true }]);
    await picker.getByRole("button", { name: "Add (1)", exact: true }).click();
    await expect(picker).toHaveCount(0);
    await expect
      .poll(
        async () =>
          (
            await pool.query(
              "select exercise_id from workout_exercises where workout_id = $1 and exercise_id = $2 and deleted_at is null",
              [workoutId, secondId],
            )
          ).rowCount,
      )
      .toBe(1);
    await page
      .getByRole("button", { name: "Exercise actions", exact: true })
      .first()
      .click();
    await page
      .getByRole("menuitem", { name: "Correct catalogue details" })
      .click();
    await page.getByRole("link", { name: "Cancel correction" }).click();
    await expect(page).toHaveURL(new RegExp(`/workouts/${workoutId}$`));
    await expect(
      page.getByText("Prototype caller context", { exact: true }),
    ).toBeVisible();
    await expect(picker).toHaveCount(0);
    await page.getByText(cue, { exact: true }).click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("heading", { name: "Mind-Muscle Connection" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
  } finally {
    await pool.query("delete from workout_sets where workout = $1", [
      workoutId,
    ]);
    await pool.query("delete from workout_exercises where workout_id = $1", [
      workoutId,
    ]);
    await pool.query("delete from workouts where id = $1", [workoutId]);
    await pool.query(
      "delete from exercise_muscle_groups where exercise = any($1::uuid[])",
      [[firstId, secondId]],
    );
    await pool.query("delete from exercises where id = any($1::uuid[])", [
      [firstId, secondId],
    ]);
  }
});
