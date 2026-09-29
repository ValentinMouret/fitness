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

test("historical template and Strong sessions retain their records", async ({
  page,
  pool,
}) => {
  const templateId = randomUUID();
  const workoutIds = [randomUUID(), randomUUID()];
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
        "insert into workouts (id, name, start, stop, notes, imported_from_strong, template_id) values ($1, $2, '1902-03-04 10:00:00', '1902-03-04 10:30:00', 'Retained session notes', $3, $4)",
        [
          id,
          `Historical acceptance ${id}`,
          index === 1,
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
        page.getByText(`Historical acceptance ${id}`, { exact: true }),
      ).toBeVisible();
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
  try {
    await page.goto(`/workouts/${workoutId}`);
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    await page.getByRole("textbox", { name: "Set 1 weight" }).fill("62.5");
    await page.getByRole("textbox", { name: "Set 1 reps" }).fill("9");
    await page.getByRole("button", { name: "Complete set 1" }).click();
    await expect(page.locator(".set-row--completed")).toBeVisible();
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
    await page.reload();
    await expect(
      page.locator(".set-row--completed").getByText("10", { exact: true }),
    ).toBeVisible();
    const stored = await pool.query(
      'select reps, weight, "isCompleted" from workout_sets where workout = $1',
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
  }
});
