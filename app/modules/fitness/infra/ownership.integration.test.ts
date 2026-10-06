import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { userIdSchema } from "~/modules/auth/domain/user";
import { bootstrapAuthOwner } from "~/modules/auth/infra/owner-bootstrap.server";
import { createDisposablePostgres } from "../../../../tests/integration/support/disposable-postgres";
import { createVolumeTrackingRepository } from "./volume-tracking-repository.server";
import {
  createWorkoutCommands,
  createWorkoutRepository,
  createWorkoutSessionRepository,
} from "./workout.repository.server";

const fixture = createDisposablePostgres(
  new URL(z.url().parse(process.env.TENANT_TEST_ADMIN_URL)),
);
const { database, pool } = fixture;
const owner = userIdSchema.parse(randomUUID());
const other = userIdSchema.parse(randomUUID());
const exerciseIds = [randomUUID(), randomUUID()];
const workoutIds = [randomUUID(), randomUUID(), randomUUID()];
const templateId = randomUUID();
const tables = [
  "workouts",
  "workout_templates",
  "workout_exercises",
  "workout_sets",
  "workout_template_exercises",
  "workout_template_sets",
];
let original: readonly (readonly Record<string, unknown>[])[] = [];
const records = () =>
  Promise.all(
    tables.map(
      async (table) =>
        (await pool.query(`select * from ${table} order by 1,2`)).rows,
    ),
  );
beforeAll(async () => {
  await fixture.create();
  await fixture.migrateBefore(16);
  for (const id of exerciseIds)
    await pool.query(
      "insert into exercises (id,name,type,movement_pattern) values ($1,$2,'barbell','push')",
      [id, `Neutral fixture ${id}`],
    );
  for (const id of exerciseIds)
    await pool.query(
      "insert into exercise_muscle_groups (exercise,muscle_group,split) values ($1,'pecs',100)",
      [id],
    );
  for (const [index, id] of workoutIds.entries()) {
    await pool.query(
      "insert into workouts (id,name,start,stop,notes,imported_from_strong,imported_from_fitbod,deleted_at) values ($1,$2,'1900-01-01 10:00:00',$3,'Historical workout note',$4,$5,$6)",
      [
        id,
        `Historical ${id}`,
        index ? null : new Date("1900-01-01T11:00:00Z"),
        index === 0,
        index === 2,
        index === 2 ? new Date("1900-01-02") : null,
      ],
    );
    for (const [order, exercise] of exerciseIds.entries()) {
      await pool.query(
        "insert into workout_exercises (workout_id,exercise_id,order_index,notes) values ($1,$2,$3,'Historical group note')",
        [id, exercise, order],
      );
      await pool.query(
        'insert into workout_sets (workout,exercise,set,reps,weight,note,"isCompleted","isWarmup",rpe,reported_rir,deleted_at) values ($1,$2,1,8,60,\'Historical set note\',$3,$4,8,$6,$5)',
        [
          id,
          exercise,
          index === 0,
          order === 1,
          index === 2 ? new Date("1900-01-02") : null,
          index === 0 && order === 0 ? "2" : null,
        ],
      );
    }
  }
  await pool.query(
    "insert into workout_templates (id,name,source_workout_id,deleted_at) values ($1,'Historical template',$2,'1900-01-02')",
    [templateId, workoutIds[0]],
  );
  await pool.query("update workouts set template_id=$1 where id=$2", [
    templateId,
    workoutIds[0],
  ]);
  await pool.query(
    "insert into workout_template_exercises (template_id,exercise_id,order_index,notes) values ($1,$2,0,'Historical template note')",
    [templateId, exerciseIds[0]],
  );
  await pool.query(
    "insert into workout_template_sets (template_id,exercise_id,set,target_reps,weight) values ($1,$2,1,8,60)",
    [templateId, exerciseIds[0]],
  );
  original = await records();
});
afterAll(() => fixture.close());
describe.sequential("personal workout ownership and history", () => {
  it("rolls back ownership DDL and every historical row without an explicit owner", async () => {
    await expect(
      migrate(database, { migrationsFolder: "./drizzle" }),
    ).rejects.toThrow();
    expect(await records()).toEqual(original);
  });
  it("rejects ambiguous bootstrap owners without changing history", async () => {
    for (const id of [owner, other])
      expect(
        (
          await bootstrapAuthOwner({
            pool,
            id,
            email: `${id}@example.invalid`,
            now: new Date(),
          })
        ).isOk(),
      ).toBe(true);
    await expect(
      migrate(database, { migrationsFolder: "./drizzle" }),
    ).rejects.toThrow();
    expect(await records()).toEqual(original);
    await pool.query("delete from auth_users where id=$1", [other]);
  });
  it("preserves workout/template IDs, import flags, order, archived rows and reported effort exactly", async () => {
    await migrate(database, { migrationsFolder: "./drizzle" });
    const migrated = await records();
    expect(
      migrated
        .slice(0, 2)
        .map((rows) => rows.map(({ user_id, ...row }) => row)),
    ).toEqual(original.slice(0, 2));
    expect(migrated.slice(2)).toEqual(original.slice(2));
    expect(
      migrated
        .slice(0, 2)
        .every((rows) => rows.every((row) => row.user_id === owner)),
    ).toBe(true);
    await pool.query(
      "insert into auth_users (id,name,email) values ($1,'Other fixture',$2)",
      [other, `${other}@example.invalid`],
    );
  });
  it("isolates session reads, metadata, sets, notes, deletion, histories and parent associations", async () => {
    const a = createWorkoutRepository(owner, database);
    const b = createWorkoutRepository(other, database);
    const aSession = createWorkoutSessionRepository(owner, database);
    const bSession = createWorkoutSessionRepository(other, database);
    const bCommands = createWorkoutCommands(other, database);
    const created = (
      await bCommands.createWorkout({
        name: "Other private workout",
        exercises: [
          {
            exerciseId: exerciseIds[0],
            sets: [
              {
                set: 1,
                reps: 3,
                weight: 10,
                isCompleted: false,
                isWarmup: false,
                isFailure: false,
              },
            ],
          },
        ],
      })
    )._unsafeUnwrap();
    const aVolume = createVolumeTrackingRepository(owner, database);
    const bVolume = createVolumeTrackingRepository(other, database);
    expect(
      (await aVolume.getWeeklyVolume(new Date("1900-01-01T00:00:00Z")))
        ._unsafeUnwrap()
        .get("pecs"),
    ).toBe(1);
    expect(
      (
        await bVolume.getWeeklyVolume(new Date("1900-01-01T00:00:00Z"))
      )._unsafeUnwrap().size,
    ).toBe(0);
    expect(
      (
        await aVolume.getHistoricalVolume(
          "pecs",
          new Date("1900-01-01"),
          new Date("1900-01-02"),
        )
      )._unsafeUnwrap(),
    ).toEqual([{ date: new Date("1900-01-01"), volume: 1 }]);
    expect(
      (
        await bVolume.getHistoricalVolume(
          "pecs",
          new Date("1900-01-01"),
          new Date("1900-01-02"),
        )
      )._unsafeUnwrap(),
    ).toEqual([]);
    expect(
      (
        await bVolume.recordWorkoutVolume(
          workoutIds[0],
          new Map(),
          new Date("1900-01-01"),
        )
      )._unsafeUnwrapErr(),
    ).toBe("not_found");
    const before = await records();
    expect((await b.findById(workoutIds[1]))._unsafeUnwrap()).toBeNull();
    expect((await bSession.findById(workoutIds[1]))._unsafeUnwrap()).toBeNull();
    expect(
      (await b.findAllWithSummary())._unsafeUnwrap().workouts.map((w) => w.id),
    ).toEqual([created.workout.id]);
    expect((await a.findInProgress())._unsafeUnwrap()?.id).toBe(workoutIds[1]);
    expect(
      (
        await bCommands.updateSet({
          workoutId: workoutIds[1],
          exerciseId: exerciseIds[0],
          set: 1,
          updates: { reps: 99 },
        })
      )._unsafeUnwrapErr().code,
    ).toBe("not_found");
    expect(
      (
        await bCommands.deleteWorkout({ workoutId: workoutIds[1] })
      )._unsafeUnwrapErr().code,
    ).toBe("not_found");
    expect(
      (
        await bSession.updateExerciseNotes(
          workoutIds[1],
          exerciseIds[0],
          "Forged",
        )
      ).isErr(),
    ).toBe(true);
    expect(
      (
        await bSession.reorderExercises(
          workoutIds[1],
          [...exerciseIds].reverse(),
        )
      ).isErr(),
    ).toBe(true);
    const foreign = (await a.findById(workoutIds[1]))._unsafeUnwrap();
    if (!foreign) throw new Error("Missing fixture");
    expect((await b.save({ ...foreign, name: "Forged" })).isErr()).toBe(true);
    expect((await b.save({ ...created.workout, templateId })).isErr()).toBe(
      true,
    );
    expect(
      (
        await b.saveSession({
          ...created,
          exerciseGroups: created.exerciseGroups.map((group) => ({
            ...group,
            sets: group.sets.map((set) => ({
              ...set,
              workoutId: workoutIds[1],
            })),
          })),
        })
      )._unsafeUnwrapErr(),
    ).toBe("validation_error");
    expect(
      (await bSession.getExerciseHistory(exerciseIds[0]))._unsafeUnwrap()
        .sessions,
    ).toEqual([]);
    expect(
      (
        await bSession.getLastCompletedSetsForExercise(exerciseIds[0])
      )._unsafeUnwrap(),
    ).toEqual([]);
    expect(
      (await aSession.getExerciseHistory(exerciseIds[0]))._unsafeUnwrap()
        .sessions,
    ).toHaveLength(1);
    expect(await records()).toEqual(before);
    await expect(
      pool.query("update workout_templates set user_id=$1 where id=$2", [
        other,
        templateId,
      ]),
    ).rejects.toThrow();
    await expect(
      pool.query(
        "insert into workout_sets (workout,exercise,set) values ($1,$2,2)",
        [created.workout.id, exerciseIds[1]],
      ),
    ).rejects.toThrow();
    await expect(
      pool.query(
        "insert into workout_template_sets (template_id,exercise_id,set) values ($1,$2,2)",
        [templateId, exerciseIds[1]],
      ),
    ).rejects.toThrow();
    expect(await records()).toEqual(before);
  });
  it("serializes legitimate changes and rejects concurrent foreign writes without losing ordering", async () => {
    const commands = createWorkoutCommands(owner, database);
    const foreign = createWorkoutCommands(other, database);
    const [legitimate, forged] = await Promise.all([
      commands.updateSet({
        workoutId: workoutIds[1],
        exerciseId: exerciseIds[0],
        set: 1,
        updates: { reps: 9 },
      }),
      foreign.updateSet({
        workoutId: workoutIds[1],
        exerciseId: exerciseIds[0],
        set: 1,
        updates: { reps: 99 },
      }),
    ]);
    expect(legitimate.isOk()).toBe(true);
    expect(forged._unsafeUnwrapErr().code).toBe("not_found");
    const sessions = createWorkoutSessionRepository(owner, database);
    expect(
      (
        await sessions.reorderExercises(
          workoutIds[1],
          [...exerciseIds].reverse(),
        )
      ).isOk(),
    ).toBe(true);
    const result = (await sessions.findById(workoutIds[1]))._unsafeUnwrap();
    expect(result?.exerciseGroups.map((group) => group.exercise.id)).toEqual(
      [...exerciseIds].reverse(),
    );
    expect(
      result?.exerciseGroups.find(
        (group) => group.exercise.id === exerciseIds[0],
      )?.sets[0].reps,
    ).toBe(9);
    expect(
      (await createWorkoutRepository(owner, database).findAllWithSummary())
        ._unsafeUnwrap()
        .workouts.find((w) => w.id === workoutIds[0])?.totalVolumeKg,
    ).toBe(480);
  });
});
