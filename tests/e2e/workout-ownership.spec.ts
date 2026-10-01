import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import pg from "pg";
import {
  canWriteFixtureDatabase,
  fixtureOwnerId,
  verifyFixtureServerDatabase,
} from "./support/fixture-database";

test.skip(
  !canWriteFixtureDatabase(process.env.E2E_DATABASE_URL),
  "Requires matching dedicated fixture database and server",
);
test.use({ viewport: { width: 390, height: 844 } });
test("foreign workout routes, actions, history and dashboard stay private and preserve records", async ({
  page,
  request,
}) => {
  const pool = new pg.Pool({ connectionString: process.env.E2E_DATABASE_URL });
  const otherId = randomUUID();
  const workoutId = randomUUID();
  const exerciseId = randomUUID();
  const name = `Other private workout ${randomUUID()}`;
  const note = `Other private note ${randomUUID()}`;
  const records = async () =>
    (
      await pool.query(
        "select to_jsonb(w) as workout,to_jsonb(we) as exercise,to_jsonb(s) as set from workouts w join workout_exercises we on we.workout_id=w.id join workout_sets s on s.workout=we.workout_id and s.exercise=we.exercise_id where w.id=$1",
        [workoutId],
      )
    ).rows;
  try {
    await verifyFixtureServerDatabase(request, pool);
    await pool.query(
      "insert into auth_users (id,name,email) values ($1,'Other workout fixture',$2)",
      [otherId, `${otherId}@example.invalid`],
    );
    await pool.query(
      "insert into auth_invitations (user_id,invited_by,expires_at,accepted_at) values ($1,$2,now(),now())",
      [otherId, fixtureOwnerId()],
    );
    await pool.query(
      "insert into exercises (id,name,type,movement_pattern) values ($1,$2,'barbell','push')",
      [exerciseId, `Neutral exercise ${exerciseId}`],
    );
    await pool.query(
      "insert into workouts (id,user_id,name,start,notes) values ($1,$2,$3,'2099-01-01',$4)",
      [workoutId, otherId, name, note],
    );
    await pool.query(
      "insert into workout_exercises (workout_id,exercise_id,order_index,notes) values ($1,$2,0,$3)",
      [workoutId, exerciseId, note],
    );
    await pool.query(
      'insert into workout_sets (workout,exercise,set,reps,weight,note,"isCompleted") values ($1,$2,1,8,60,$3,true)',
      [workoutId, exerciseId, note],
    );
    const before = await records();
    await page.goto("/workouts");
    await expect(page.getByText(name, { exact: true })).toHaveCount(0);
    await page.goto("/dashboard");
    await expect(page.getByText(name, { exact: true })).toHaveCount(0);
    for (const path of [
      `/workouts/${workoutId}`,
      `/workouts/${workoutId}.data`,
      `/workouts/${workoutId}/substitute/${exerciseId}`,
    ]) {
      const response = await request.get(path);
      expect(response.status()).toBe(404);
      expect(await response.text()).not.toContain(note);
    }
    for (const intent of [
      "update-name",
      "add-exercise",
      "add-exercises",
      "update-exercise-mmc",
      "update-exercise-notes",
      "remove-exercise",
      "add-set",
      "update-set",
      "replace-exercise",
      "reorder-exercises",
      "remove-set",
      "complete-workout",
      "cancel-workout",
      "delete-workout",
      "duplicate-workout",
    ]) {
      const response = await request.post(`/workouts/${workoutId}`, {
        form: {
          intent,
          name: "Forged",
          exerciseId,
          reps: "99",
          set: "1",
          notes: "Forged",
          mmcInstructions: "Forged",
        },
      });
      expect(response.status()).toBe(404);
    }
    const history = await request.get(
      `/api/exercises/history?exerciseId=${exerciseId}`,
    );
    expect(history.ok()).toBe(true);
    expect(await history.text()).not.toContain(name);
    await pool.query(
      "update workouts set stop='2099-01-01 11:00:00' where id=$1",
      [workoutId],
    );
    const completed = await records();
    const completedHistory = await request.get(
      `/api/exercises/history?exerciseId=${exerciseId}`,
    );
    expect(completedHistory.ok()).toBe(true);
    expect(await completedHistory.text()).not.toContain(name);
    await pool.query("update workouts set stop=null where id=$1", [workoutId]);
    expect(await records()).toEqual(before);
    expect(completed).toHaveLength(1);
    expect(
      (
        await pool.query("select mmc_instructions from exercises where id=$1", [
          exerciseId,
        ])
      ).rows,
    ).toEqual([{ mmc_instructions: null }]);
  } finally {
    await pool.query("delete from workout_sets where workout=$1", [workoutId]);
    await pool.query("delete from workout_exercises where workout_id=$1", [
      workoutId,
    ]);
    await pool.query("delete from workouts where id=$1", [workoutId]);
    await pool.query("delete from exercises where id=$1", [exerciseId]);
    await pool.query("delete from auth_users where id=$1", [otherId]);
    await pool.end();
  }
});

test("workout cue editing requires exercise membership and keeps saved content private", async ({
  page,
  request,
}) => {
  const pool = new pg.Pool({ connectionString: process.env.E2E_DATABASE_URL });
  const workoutId = randomUUID();
  const exerciseId = randomUUID();
  const unrelatedId = randomUUID();
  const owner = fixtureOwnerId();
  const cue = `Private cue ${randomUUID()}`;
  try {
    await verifyFixtureServerDatabase(request, pool);
    await pool.query(
      "insert into exercises(id,name,type,movement_pattern) values ($1,$3,'dumbbells','push'),($2,$4,'dumbbells','push')",
      [
        exerciseId,
        unrelatedId,
        `Cue lift ${exerciseId}`,
        `Unrelated lift ${unrelatedId}`,
      ],
    );
    await pool.query(
      "insert into exercise_muscle_groups(exercise,muscle_group,split) values ($1,'pecs',100),($2,'pecs',100)",
      [exerciseId, unrelatedId],
    );
    await pool.query(
      "insert into workouts(id,user_id,name,start) values ($1,$2,'Private cue test workout',now())",
      [workoutId, owner],
    );
    await pool.query(
      "insert into workout_exercises(workout_id,exercise_id,order_index) values ($1,$2,0)",
      [workoutId, exerciseId],
    );
    const rejected = await request.post(`/workouts/${workoutId}`, {
      form: {
        intent: "update-exercise-mmc",
        exerciseId: unrelatedId,
        mmcInstructions: "Forged cue",
      },
    });
    expect(rejected.status()).toBe(404);
    expect(
      (
        await pool.query(
          "select exercise_id from exercise_preferences where exercise_id=$1",
          [unrelatedId],
        )
      ).rows,
    ).toEqual([]);
    await page.goto(`/workouts/${workoutId}?exercise=${exerciseId}`);
    await page.getByRole("button", { name: "+ Add mind-muscle cue" }).click();
    await page.getByLabel("Focus Cues & Instructions").fill(cue);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText(cue, { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText(cue, { exact: true })).toBeVisible();
    expect(
      (
        await pool.query(
          "select user_id,mmc_instructions from exercise_preferences where exercise_id=$1",
          [exerciseId],
        )
      ).rows,
    ).toEqual([{ user_id: owner, mmc_instructions: cue }]);
    expect(
      (
        await pool.query(
          "select description,mmc_instructions from exercises where id=$1",
          [exerciseId],
        )
      ).rows,
    ).toEqual([{ description: null, mmc_instructions: null }]);
  } finally {
    await pool.query(
      "delete from exercise_preferences where exercise_id=any($1::uuid[])",
      [[exerciseId, unrelatedId]],
    );
    await pool.query("delete from workout_sets where workout=$1", [workoutId]);
    await pool.query("delete from workout_exercises where workout_id=$1", [
      workoutId,
    ]);
    await pool.query("delete from workouts where id=$1", [workoutId]);
    await pool.query(
      "delete from exercise_muscle_groups where exercise=any($1::uuid[])",
      [[exerciseId, unrelatedId]],
    );
    await pool.query("delete from exercises where id=any($1::uuid[])", [
      [exerciseId, unrelatedId],
    ]);
    await pool.end();
  }
});
