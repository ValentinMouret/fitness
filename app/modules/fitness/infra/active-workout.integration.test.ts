import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, expect, it } from "vitest";
import { z } from "zod";
import { userIdSchema } from "~/modules/auth/domain/user";
import { bootstrapAuthOwner } from "~/modules/auth/infra/owner-bootstrap.server";
import { createDisposablePostgres } from "../../../../tests/integration/support/disposable-postgres";
import {
  createActiveWorkoutCommands,
  createWorkoutCommands,
} from "./workout.repository.server";

const fixture = createDisposablePostgres(
  new URL(z.url().parse(process.env.TENANT_TEST_ADMIN_URL)),
);
const owner = userIdSchema.parse(randomUUID()),
  other = userIdSchema.parse(randomUUID()),
  exercise = randomUUID();
const commands = createActiveWorkoutCommands(owner, fixture.database);
beforeAll(async () => {
  await fixture.create();
  await fixture.migrateBefore(16);
  await bootstrapAuthOwner({
    pool: fixture.pool,
    id: owner,
    email: `${owner}@example.invalid`,
    now: new Date(),
  });
  await migrate(fixture.database, { migrationsFolder: "./drizzle" });
  await fixture.pool.query(
    "insert into exercises (id,name,type,movement_pattern) values ($1,'Synthetic press','barbell','push')",
    [exercise],
  );
});
afterAll(() => fixture.close());
async function workout() {
  const created = await createWorkoutCommands(
    owner,
    fixture.database,
  ).createWorkout({
    name: "Synthetic active",
    exercises: [
      {
        exerciseId: exercise,
        sets: [
          {
            set: 1,
            targetReps: 12,
            reps: 8,
            weight: 40,
            reportedRir: "2",
            isCompleted: true,
            isWarmup: false,
            isFailure: false,
          },
          { set: 2, isCompleted: false, isWarmup: false, isFailure: false },
        ],
      },
    ],
  });
  if (created.isErr()) throw new Error(created.error.message);
  const id = created.value.workout.id,
    snapshot = await commands.read({ workoutId: id });
  if (snapshot.isErr()) throw new Error(snapshot.error.message);
  return { id, snapshot: snapshot.value };
}
it("patches actual logging, preserves prescription/identity/other sets and rejects a stale concurrent writer", async () => {
  const { id, snapshot } = await workout();
  const input = {
    workoutId: id,
    expectedRevision: snapshot.revision,
    exerciseId: exercise,
    set: 1,
    updates: { reps: 9, isCompleted: true },
  };
  const results = await Promise.all([
    commands.updateSet(input),
    commands.updateSet({ ...input, updates: { reps: 10 } }),
  ]);
  expect(results.filter((r) => r.isOk())).toHaveLength(1);
  expect(results.find((r) => r.isErr())?._unsafeUnwrapErr().code).toBe(
    "conflict",
  );
  const fresh = (await commands.read({ workoutId: id }))._unsafeUnwrap();
  expect(fresh.exerciseGroups[0].sets[0]).toMatchObject({
    set: 1,
    targetReps: 12,
    weight: 40,
    reportedRir: "2",
  });
  expect(fresh.exerciseGroups[0].sets[1]).toMatchObject({
    set: 2,
    reps: null,
    isCompleted: false,
  });
  expect(fresh.revision).not.toBe(snapshot.revision);
  expect(
    (
      await commands.finishWorkout({
        workoutId: id,
        expectedRevision: snapshot.revision,
      })
    )._unsafeUnwrapErr().code,
  ).toBe("conflict");
  const finished = (
    await commands.finishWorkout({
      workoutId: id,
      expectedRevision: fresh.revision,
    })
  )._unsafeUnwrap();
  expect(finished.workout.stop).not.toBeNull();
  expect(finished.exerciseGroups[0].sets[1].isCompleted).toBe(false);
  expect(
    (
      await commands.updateSet({
        ...input,
        expectedRevision: finished.revision,
      })
    )._unsafeUnwrapErr().code,
  ).toBe("conflict");
});
it("denies another account reads and writes without exposing a revision", async () => {
  const { id, snapshot } = await workout();
  const foreign = createActiveWorkoutCommands(other, fixture.database);
  expect((await foreign.read({ workoutId: id }))._unsafeUnwrapErr().code).toBe(
    "not_found",
  );
  expect(
    (
      await foreign.updateSet({
        workoutId: id,
        expectedRevision: snapshot.revision,
        exerciseId: exercise,
        set: 1,
        updates: { reps: 20 },
      })
    )._unsafeUnwrapErr().code,
  ).toBe("not_found");
});
it("detects deletion and recreation with identical values and composite identity", async () => {
  const { id, snapshot } = await workout();
  const original = (
    await fixture.pool.query(
      "select updated_at::text as updated_at from workout_sets where workout=$1 and exercise=$2 and set=1",
      [id, exercise],
    )
  ).rows[0];
  await createWorkoutCommands(owner, fixture.database).deleteSets({
    workoutId: id,
    exerciseId: exercise,
    sets: [1],
  });
  await createWorkoutCommands(owner, fixture.database).saveSets({
    workoutId: id,
    exerciseId: exercise,
    sets: [
      {
        set: 1,
        targetReps: 12,
        reps: 8,
        weight: 40,
        reportedRir: "2",
        isCompleted: true,
        isWarmup: false,
        isFailure: false,
      },
    ],
  });
  await fixture.pool.query(
    "update workout_sets set updated_at=$3 where workout=$1 and exercise=$2 and set=1",
    [id, exercise, original.updated_at],
  );
  expect(
    (
      await commands.updateSet({
        workoutId: id,
        expectedRevision: snapshot.revision,
        exerciseId: exercise,
        set: 1,
        updates: { reps: 99 },
      })
    )._unsafeUnwrapErr().code,
  ).toBe("conflict");
  const fresh = (await commands.read({ workoutId: id }))._unsafeUnwrap();
  expect(fresh.exerciseGroups[0].sets[0].reps).toBe(8);
});

it("rolls back invalid effort without changing authoritative revision and clears weight explicitly", async () => {
  const { id, snapshot } = await workout();
  const invalid = await commands.updateSet({
    workoutId: id,
    expectedRevision: snapshot.revision,
    exerciseId: exercise,
    set: 2,
    updates: { reportedRir: "2" },
  });
  expect(invalid._unsafeUnwrapErr().code).toBe("invalid_input");
  expect(
    (await commands.read({ workoutId: id }))._unsafeUnwrap().revision,
  ).toBe(snapshot.revision);
  const logged = (
    await commands.updateSet({
      workoutId: id,
      expectedRevision: snapshot.revision,
      exerciseId: exercise,
      set: 1,
      updates: { weight: null },
    })
  )._unsafeUnwrap();
  expect(logged.exerciseGroups[0].sets[0]).toMatchObject({
    weight: null,
    reps: 8,
    targetReps: 12,
    reportedRir: "2",
    isCompleted: true,
  });
});

it("returns the persisted revision for chained updates and completion", async () => {
  const { id, snapshot } = await workout();
  const first = (
    await commands.updateSet({
      workoutId: id,
      expectedRevision: snapshot.revision,
      exerciseId: exercise,
      set: 1,
      updates: { reps: 9 },
    })
  )._unsafeUnwrap();
  const read = (await commands.read({ workoutId: id }))._unsafeUnwrap();
  expect(first).toEqual(read);
  const second = (
    await commands.updateSet({
      workoutId: id,
      expectedRevision: first.revision,
      exerciseId: exercise,
      set: 1,
      updates: { weight: 42 },
    })
  )._unsafeUnwrap();
  expect(second).toEqual(
    (await commands.read({ workoutId: id }))._unsafeUnwrap(),
  );
  const finished = (
    await commands.finishWorkout({
      workoutId: id,
      expectedRevision: second.revision,
    })
  )._unsafeUnwrap();
  expect(finished).toEqual(
    (await commands.read({ workoutId: id }))._unsafeUnwrap(),
  );
});
