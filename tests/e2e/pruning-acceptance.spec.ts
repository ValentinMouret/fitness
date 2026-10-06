import { randomUUID } from "node:crypto";
import { test as base, expect } from "@playwright/test";
import pg from "pg";
import {
  canWriteFixtureDatabase,
  verifyFixtureServerDatabase,
} from "./support/fixture-database";

const databaseUrl = process.env.E2E_DATABASE_URL;
const test = base.extend<{ readonly pool: pg.Pool }>({
  pool: async ({ request }, use) => {
    const pool = new pg.Pool({ connectionString: databaseUrl });
    try {
      await verifyFixtureServerDatabase(request, pool);
      await use(pool);
    } finally {
      await pool.end();
    }
  },
});
test.skip(
  !canWriteFixtureDatabase(databaseUrl),
  "Requires isolated CI DB or explicit local E2E_ALLOW_FIXTURE_WRITES with matching test DB/server",
);
test.use({ viewport: { width: 390, height: 844 } });

test("historical template, Strong and Fitbod sessions retain their records", async ({
  page,
  pool,
}) => {
  const templateId = randomUUID();
  const workoutIds = [randomUUID(), randomUUID(), randomUUID()];
  const exercise = await pool.query<{ id: string }>(
    "select id from exercises where deleted_at is null order by created_at, id limit 1",
  );
  expect(exercise.rows).toHaveLength(1);
  const exerciseId = exercise.rows[0].id;
  try {
    await pool.query(
      "insert into workout_templates (id, name) values ($1, 'Retained acceptance template')",
      [templateId],
    );
    for (const [index, id] of workoutIds.entries()) {
      await pool.query(
        "insert into workouts (id, name, start, stop, notes, imported_from_strong, imported_from_fitbod, template_id) values ($1, $2, '1902-03-04 10:00:00', '1902-03-04 10:30:00', 'Retained session notes', $3, $4, $5)",
        [
          id,
          `Historical acceptance ${id}`,
          index === 1,
          index === 2,
          index === 0 ? templateId : null,
        ],
      );
      await pool.query(
        "insert into workout_exercises (workout_id, exercise_id, order_index, notes) values ($1, $2, 0, 'Retained exercise notes')",
        [id, exerciseId],
      );
      await pool.query(
        "insert into workout_sets (workout, exercise, set, reps, weight, note, \"isCompleted\") values ($1, $2, 1, 8, 62.5, 'Retained set note', true)",
        [id, exerciseId],
      );
    }
    const before = await pool.query(
      "select to_jsonb(w) as record from workouts w where id = any($1::uuid[]) order by id",
      [workoutIds],
    );
    const exercisesBefore = await pool.query(
      "select to_jsonb(e) as record from workout_exercises e where workout_id = any($1::uuid[]) order by workout_id",
      [workoutIds],
    );
    const setsBefore = await pool.query(
      "select to_jsonb(s) as record from workout_sets s where workout = any($1::uuid[]) order by workout",
      [workoutIds],
    );
    for (const id of workoutIds) {
      await page.goto(`/workouts/${id}`);
      await expect(
        page.getByRole("heading", {
          name: `Historical acceptance ${id}`,
          exact: true,
        }),
      ).toBeVisible();
      await page.getByRole("link", { name: /^Open / }).click();
      await expect(page.getByText("62.5", { exact: true })).toBeVisible();
      await page.reload();
      await expect(page.getByText("62.5", { exact: true })).toBeVisible();
    }
    const after = await pool.query(
      "select to_jsonb(w) as record from workouts w where id = any($1::uuid[]) order by id",
      [workoutIds],
    );
    const setsAfter = await pool.query(
      "select to_jsonb(s) as record from workout_sets s where workout = any($1::uuid[]) order by workout",
      [workoutIds],
    );
    expect(after.rows).toEqual(before.rows);
    expect(setsAfter.rows).toEqual(setsBefore.rows);
    const exercisesAfter = await pool.query(
      "select to_jsonb(e) as record from workout_exercises e where workout_id = any($1::uuid[]) order by workout_id",
      [workoutIds],
    );
    expect(exercisesAfter.rows).toEqual(exercisesBefore.rows);
    expect(
      (
        await pool.query("select id from workout_templates where id = $1", [
          templateId,
        ])
      ).rowCount,
    ).toBe(1);
  } finally {
    await pool.query(
      "delete from workout_sets where workout = any($1::uuid[])",
      [workoutIds],
    );
    await pool.query(
      "delete from workout_exercises where workout_id = any($1::uuid[])",
      [workoutIds],
    );
    await pool.query("delete from workouts where id = any($1::uuid[])", [
      workoutIds,
    ]);
    await pool.query("delete from workout_templates where id = $1", [
      templateId,
    ]);
  }
});

test("unfinished Fitbod history does not replace the current native workout", async ({
  page,
  pool,
}) => {
  const nativeId = randomUUID();
  const importedId = randomUUID();
  try {
    await pool.query(
      "insert into workouts (id, name, start, imported_from_fitbod) values ($1, $2, '2098-01-01 10:00:00', false), ($3, $4, '2099-01-01 10:00:00', true)",
      [
        nativeId,
        `Native acceptance ${nativeId}`,
        importedId,
        `Unfinished Fitbod ${importedId}`,
      ],
    );
    const before = await pool.query(
      "select to_jsonb(w) as record from workouts w where id = $1",
      [importedId],
    );
    await page.goto("/dashboard");
    const current = page.getByRole("link", {
      name: new RegExp(`Native acceptance ${nativeId}`),
    });
    await expect(current).toHaveAttribute("href", `/workouts/${nativeId}`);
    await current.click();
    await expect(page).toHaveURL(new RegExp(`/workouts/${nativeId}$`));
    await expect(
      page.getByRole("heading", {
        name: `Native acceptance ${nativeId}`,
        exact: true,
      }),
    ).toBeVisible();
    const after = await pool.query(
      "select to_jsonb(w) as record from workouts w where id = $1",
      [importedId],
    );
    expect(after.rows).toEqual(before.rows);
  } finally {
    await pool.query("delete from workouts where id = any($1::uuid[])", [
      [nativeId, importedId],
    ]);
  }
});

test("a current session created by MCP operations remains editable and loggable", async ({
  page,
  pool,
}) => {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { workoutOperations } = await import(
    "../../app/modules/fitness/application/workout-operations"
  );
  const { createWorkoutSchema } = await import(
    "../../app/modules/fitness/domain/workout-commands"
  );
  const { createWorkoutRepository } = await import(
    "../../app/modules/fitness/infra/workout.repository.server"
  );
  const exercise = await pool.query<{ id: string }>(
    "select id from exercises where deleted_at is null order by created_at, id limit 1",
  );
  expect(exercise.rows).toHaveLength(1);
  const name = `MCP acceptance ${randomUUID()}`;
  const result = await workoutOperations(
    createWorkoutRepository(drizzle(pool)),
  ).createWorkout(
    createWorkoutSchema.parse({
      name,
      notes: "Agent session notes",
      exercises: [
        {
          exerciseId: exercise.rows[0].id,
          sets: [{ set: 1, targetReps: 8, weight: 60 }],
        },
      ],
    }),
  );
  const created = result._unsafeUnwrap();
  const workoutId = created.workout.id;
  const replacementId = randomUUID();
  const replacementName = `Replacement acceptance ${replacementId}`;
  try {
    await pool.query(
      "insert into exercises (id, name, type, movement_pattern) values ($1, $2, 'barbell', 'push')",
      [replacementId, replacementName],
    );
    await page.goto(`/workouts/${workoutId}`);
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: /^Open / }).click();
    await page
      .getByRole("button", { name: "Exercise actions", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "Replace Exercise" }).click();
    const selector = page.getByRole("dialog");
    await expect(
      selector.getByRole("heading", { name: "Replace Exercise", exact: true }),
    ).toBeVisible();
    await selector
      .getByPlaceholder("Search exercises...")
      .fill(replacementName);
    await selector.getByText(replacementName, { exact: true }).click();
    await selector
      .getByRole("button", { name: "Replace", exact: true })
      .click();
    await expect(selector).toHaveCount(0);
    await expect
      .poll(
        async () =>
          (
            await pool.query(
              "select exercise from workout_sets where workout = $1 and deleted_at is null",
              [workoutId],
            )
          ).rows,
      )
      .toEqual([{ exercise: replacementId }]);
    await page.reload();
    await expect(page).toHaveURL(
      `/workouts/${workoutId}?exercise=${replacementId}`,
    );
    await expect(
      page.getByRole("button", { name: replacementName, exact: true }),
    ).toBeVisible();
    await page.goto(`/workouts/${workoutId}/substitute/${replacementId}`);
    await expect(
      page.getByRole("heading", {
        name: "Find Exercise Substitute",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Find Substitute", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Cancel", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/workouts/${workoutId}$`));
    await page
      .getByRole("link", { name: `Open ${replacementName}`, exact: true })
      .click();
    await page.getByRole("textbox", { name: "Set 1 weight" }).fill("62.5");
    await page.getByRole("textbox", { name: "Set 1 reps" }).fill("9");
    await page.getByRole("button", { name: "Complete set 1" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page
      .locator(".set-row__report-prompt")
      .getByRole("button", { name: "Skip", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Keep training", exact: true })
      .click();
    await expect(page.locator(".set-row--completed")).toBeVisible();
    await expect
      .poll(
        async () =>
          (
            await pool.query(
              'select reps, weight, "isCompleted" from workout_sets where workout = $1 and deleted_at is null',
              [workoutId],
            )
          ).rows,
      )
      .toEqual([{ reps: 9, weight: 62.5, isCompleted: true }]);
    await page.reload();
    await expect(
      page.locator(".set-row--completed").getByText("62.5", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Edit set 1", exact: true }).click();
    await page.getByRole("textbox", { name: "Set 1 reps" }).fill("10");
    await page
      .locator(".set-row--completed")
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (
            await pool.query(
              'select reps, weight, "isCompleted" from workout_sets where workout = $1 and deleted_at is null',
              [workoutId],
            )
          ).rows,
      )
      .toEqual([{ reps: 10, weight: 62.5, isCompleted: true }]);
    await page.reload();
    await expect(
      page.locator(".set-row--completed").getByText("10", { exact: true }),
    ).toBeVisible();
    const stored = await pool.query(
      'select reps, weight, "isCompleted" from workout_sets where workout = $1 and deleted_at is null',
      [workoutId],
    );
    expect(stored.rows).toEqual([
      { reps: 10, weight: 62.5, isCompleted: true },
    ]);
    const session = await pool.query(
      "select notes from workouts where id = $1",
      [workoutId],
    );
    expect(session.rows).toEqual([{ notes: "Agent session notes" }]);
  } finally {
    await pool.query("delete from workout_sets where workout = $1", [
      workoutId,
    ]);
    await pool.query("delete from workout_exercises where workout_id = $1", [
      workoutId,
    ]);
    await pool.query("delete from workouts where id = $1", [workoutId]);
    await pool.query("delete from exercises where id = $1", [replacementId]);
  }
});
