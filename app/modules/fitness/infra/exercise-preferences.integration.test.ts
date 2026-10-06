import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { env } from "~/env.server";
import { userIdSchema } from "~/modules/auth/domain/user";
import { bootstrapAuthOwner } from "~/modules/auth/infra/owner-bootstrap.server";
import { createDisposablePostgres } from "../../../../tests/integration/support/disposable-postgres";
import { updateWorkoutExerciseCue } from "./exercise-preferences.repository.server";
import {
  createExerciseMuscleGroupsRepository,
  createExerciseRepository,
} from "./repository.server";
import {
  createWorkoutCommands,
  createWorkoutSessionRepository,
} from "./workout.repository.server";

const adminUrl = new URL(z.url().parse(process.env.TENANT_TEST_ADMIN_URL));
const owner = userIdSchema.parse(env.AUTH_FOUNDATION_OWNER_USER_ID);
const other = userIdSchema.parse(randomUUID());
const fixture = createDisposablePostgres(adminUrl);
const { pool, database } = fixture;
const exercise = randomUUID();
const archived = randomUUID();
const unrelated = randomUUID();
const aWorkout = randomUUID();
const bWorkout = randomUUID();

beforeAll(async () => {
  await fixture.create();
  await fixture.migrateBefore(19);
  await pool.query(
    "insert into exercises(id,name,type,movement_pattern,description,mmc_instructions,deleted_at) values ($1,'Retained lift','dumbbells','push','Owner private description','Owner cue',null), ($2,'Archived lift','dumbbells','push','Archived private description','Archived cue','1900-01-01'), ($3,'Unrelated lift','dumbbells','push',null,null,null)",
    [exercise, archived, unrelated],
  );
  expect(
    (
      await bootstrapAuthOwner({
        pool,
        id: owner,
        email: "owner@example.invalid",
        now: new Date(),
      })
    ).isOk(),
  ).toBe(true);
  await migrate(database, { migrationsFolder: "drizzle" });
  await pool.query(
    "insert into auth_users(id,name,email) values ($1,'B','b@example.invalid')",
    [other],
  );
  await pool.query(
    "insert into auth_invitations(user_id,invited_by,expires_at,accepted_at) values ($1,$2,now(),now())",
    [other, owner],
  );
  await pool.query(
    "insert into exercise_muscle_groups(exercise,muscle_group,split) values ($1,'pecs',100), ($2,'pecs',100), ($3,'pecs',100)",
    [exercise, archived, unrelated],
  );
  await pool.query(
    "insert into workouts(id,user_id,name,start) values ($1,$2,'A workout',now()),($3,$4,'B workout',now())",
    [aWorkout, owner, bWorkout, other],
  );
  await pool.query(
    "insert into workout_exercises(workout_id,exercise_id,order_index) values ($1,$3,0),($2,$3,0)",
    [aWorkout, bWorkout, exercise],
  );
});
afterAll(() => fixture.close());

describe.sequential("private exercise content", () => {
  it("preserves owner content including archived exercises without exposing it to B or a missing SQL actor", async () => {
    expect(
      (
        await pool.query(
          "select description,mmc_instructions from exercises where id=any($1::uuid[])",
          [[exercise, archived]],
        )
      ).rows,
    ).toEqual([
      { description: null, mmc_instructions: null },
      { description: null, mmc_instructions: null },
    ]);
    expect(
      (
        await pool.query(
          "select exercise_id,description,mmc_instructions from exercise_preferences where user_id=$1 order by exercise_id",
          [owner],
        )
      ).rows,
    ).toEqual(
      [
        {
          exercise_id: exercise,
          description: "Owner private description",
          mmc_instructions: "Owner cue",
        },
        {
          exercise_id: archived,
          description: "Archived private description",
          mmc_instructions: "Archived cue",
        },
      ].sort((a, b) => a.exercise_id.localeCompare(b.exercise_id)),
    );
    const a = (
      await createExerciseRepository(owner, database).listAll()
    )._unsafeUnwrap();
    const b = (
      await createExerciseRepository(other, database).listAll()
    )._unsafeUnwrap();
    expect(a.find((entry) => entry.id === exercise)?.mmcInstructions).toBe(
      "Owner cue",
    );
    expect(
      b.find((entry) => entry.id === exercise)?.description,
    ).toBeUndefined();
    expect(
      b.find((entry) => entry.id === exercise)?.mmcInstructions,
    ).toBeUndefined();
    const own = (
      await createWorkoutSessionRepository(owner, database).findById(aWorkout)
    )._unsafeUnwrap();
    const foreign = (
      await createWorkoutSessionRepository(other, database).findById(bWorkout)
    )._unsafeUnwrap();
    expect(own?.exerciseGroups[0].exercise.mmcInstructions).toBe("Owner cue");
    expect(foreign?.exerciseGroups[0].exercise.mmcInstructions).toBeUndefined();
    for (const actor of [owner, other, ""]) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query("select set_config('fitness.user_id',$1,true)", [
          actor,
        ]);
        const [row] = (
          await client.query(
            "select description,mmc_instructions from fitness_data.exercises where id=$1",
            [exercise],
          )
        ).rows;
        expect(row).toEqual(
          actor === owner
            ? {
                description: "Owner private description",
                mmc_instructions: "Owner cue",
              }
            : { description: null, mmc_instructions: null },
        );
      } finally {
        await client.query("rollback");
        client.release();
      }
    }
  });

  it("checks workout ownership and exercise membership before editing only the actor cue", async () => {
    const before = (
      await pool.query(
        "select * from exercise_preferences order by user_id,exercise_id",
      )
    ).rows;
    for (const input of [
      { workoutId: bWorkout, exerciseId: exercise },
      { workoutId: aWorkout, exerciseId: unrelated },
      { workoutId: aWorkout, exerciseId: archived },
      { workoutId: randomUUID(), exerciseId: exercise },
    ])
      expect(
        await updateWorkoutExerciseCue(
          owner,
          { ...input, mmcInstructions: "Forged" },
          database,
        ),
      ).toBe(false);
    expect(
      (
        await pool.query(
          "select * from exercise_preferences order by user_id,exercise_id",
        )
      ).rows,
    ).toEqual(before);
    expect(
      await updateWorkoutExerciseCue(
        other,
        { workoutId: bWorkout, exerciseId: exercise, mmcInstructions: "B cue" },
        database,
      ),
    ).toBe(true);
    expect(
      (
        await createExerciseMuscleGroupsRepository(other, database).findById(
          exercise,
        )
      )._unsafeUnwrap()?.exercise.mmcInstructions,
    ).toBe("B cue");
    expect(
      (
        await createExerciseMuscleGroupsRepository(owner, database).findById(
          exercise,
        )
      )._unsafeUnwrap()?.exercise.mmcInstructions,
    ).toBe("Owner cue");
    expect(
      await updateWorkoutExerciseCue(
        other,
        { workoutId: bWorkout, exerciseId: exercise },
        database,
      ),
    ).toBe(true);
    expect(
      (
        await createExerciseMuscleGroupsRepository(other, database).findById(
          exercise,
        )
      )._unsafeUnwrap()?.exercise.mmcInstructions,
    ).toBeUndefined();
    expect(
      (
        await pool.query(
          "select description from exercise_preferences where user_id=$1 and exercise_id=$2",
          [owner, exercise],
        )
      ).rows[0].description,
    ).toBe("Owner private description");
  });

  it("rejects B canonical correction and retains exercise identity when the owner corrects it", async () => {
    const a = createExerciseMuscleGroupsRepository(owner, database);
    const b = createExerciseMuscleGroupsRepository(other, database);
    const entry = (await a.findById(exercise))._unsafeUnwrap();
    if (!entry) throw new Error("Missing exercise fixture");
    expect(
      (
        await b.save({
          ...entry,
          exercise: { ...entry.exercise, name: "B global correction" },
        })
      ).isErr(),
    ).toBe(true);
    expect((await b.deleteById(exercise)).isErr()).toBe(true);
    expect(
      (
        await createWorkoutCommands(other, database).createExercise({
          name: "B forbidden catalogue entry",
          type: "dumbbells",
          movementPattern: "push",
          muscleGroupSplits: [{ muscleGroup: "pecs", split: 100 }],
        })
      ).isErr(),
    ).toBe(true);
    expect(
      (
        await pool.query(
          "select id from exercises where name='B forbidden catalogue entry'",
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await a.save({
          ...entry,
          exercise: { ...entry.exercise, name: "Owner corrected lift" },
        })
      ).isOk(),
    ).toBe(true);
    expect(
      (
        await pool.query("select id,name from exercises where id=$1", [
          exercise,
        ])
      ).rows,
    ).toEqual([{ id: exercise, name: "Owner corrected lift" }]);
    expect(
      (
        await pool.query(
          "select exercise_id from workout_exercises where exercise_id=$1",
          [exercise],
        )
      ).rows,
    ).toEqual([{ exercise_id: exercise }, { exercise_id: exercise }]);
    expect(
      (await a.findById(exercise))._unsafeUnwrap()?.exercise.mmcInstructions,
    ).toBe("Owner cue");
    expect(
      (await b.findById(exercise))._unsafeUnwrap()?.exercise.mmcInstructions,
    ).toBeUndefined();
    expect((await a.deleteById(exercise)).isOk()).toBe(true);
    expect(
      (await a.listAll())
        ._unsafeUnwrap()
        .some((entry) => entry.exercise.id === exercise),
    ).toBe(false);
    const history = (
      await createWorkoutSessionRepository(owner, database).findById(aWorkout)
    )._unsafeUnwrap();
    expect(history?.exerciseGroups[0].exercise.id).toBe(exercise);
    expect(history?.exerciseGroups[0].exercise.mmcInstructions).toBe(
      "Owner cue",
    );
  });
});

it.each([0, 2])(
  "refuses private-content backfill with %i accepted self owners",
  async (count) => {
    const isolated = createDisposablePostgres(adminUrl);
    try {
      await isolated.create();
      await isolated.migrateBefore(19);
      await isolated.pool.query(
        "insert into exercises(name,type,movement_pattern,mmc_instructions) values ('Unassigned cue','dumbbells','push','Keep private')",
      );
      for (let index = 0; index < count; index++) {
        const id = randomUUID();
        expect(
          (
            await bootstrapAuthOwner({
              pool: isolated.pool,
              id,
              email: `${id}@example.invalid`,
              now: new Date(),
            })
          ).isOk(),
        ).toBe(true);
      }
      await expect(
        migrate(isolated.database, { migrationsFolder: "drizzle" }),
      ).rejects.toThrow();
      expect(
        (await isolated.pool.query("select mmc_instructions from exercises"))
          .rows,
      ).toEqual([{ mmc_instructions: "Keep private" }]);
      expect(
        (
          await isolated.pool.query(
            "select to_regclass('public.exercise_preferences') as preferences",
          )
        ).rows[0].preferences,
      ).toBeNull();
    } finally {
      await isolated.close();
    }
  },
);
