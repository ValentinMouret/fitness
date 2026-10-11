import { errAsync, okAsync } from "neverthrow";
import { describe, expect, it } from "vitest";
import type { WorkoutSession } from "../domain/workout";
import { failure } from "../domain/workout-commands";
import { workoutOperations } from "./workout-operations";

const workoutId = "3a12b433-0e67-4c6a-a7c3-38a4b32b955d";
const exerciseId = "62b242cd-862f-4f47-9d88-68bbfb488727";

const session: WorkoutSession = {
  workout: { id: workoutId, name: "Upper A", start: new Date("2026-10-10") },
  exerciseGroups: [
    {
      exercise: {
        id: exerciseId,
        name: "Bench Press",
        type: "barbell",
        movementPattern: "push",
      },
      orderIndex: 0,
      sets: [
        {
          workoutId,
          exerciseId,
          set: 1,
          reps: 8,
          weight: 60,
          isCompleted: true,
          isFailure: false,
          isWarmup: false,
          reportedRir: "2",
        },
      ],
    },
  ],
};

const operationsOn = (current: WorkoutSession) =>
  workoutOperations({
    createSession: () => errAsync(failure("database_error", "unused")),
    deleteSession: () => errAsync(failure("database_error", "unused")),
    createExercise: () => errAsync(failure("database_error", "unused")),
    changeSession: (_id, change) => {
      const changed = change(current, []);
      return changed.isOk() ? okAsync(changed.value) : errAsync(changed.error);
    },
  });

describe("updateSet", () => {
  // Effort belongs to completed working sets and is never dropped implicitly.
  it.each([
    { isWarmup: true },
    { isCompleted: false },
    { isWarmup: true, reportedRir: "1" as const },
  ])("rejects %j while the set keeps its effort", async (updates) => {
    const result = await operationsOn(session).updateSet({
      workoutId,
      exerciseId,
      set: 1,
      updates,
    });
    expect(result._unsafeUnwrapErr().code).toBe("invalid_input");
  });

  it.each([
    { isWarmup: true, reportedRir: null },
    { isCompleted: false, reportedRir: null },
  ])("accepts %j when the effort is cleared", async (updates) => {
    const result = await operationsOn(session).updateSet({
      workoutId,
      exerciseId,
      set: 1,
      updates,
    });
    expect(result._unsafeUnwrap().exerciseGroups[0].sets[0]).toMatchObject({
      ...updates,
      reportedRir: undefined,
    });
  });
});

describe("appendSet", () => {
  it("numbers the new set after the highest existing set", async () => {
    const withGap: WorkoutSession = {
      ...session,
      exerciseGroups: [
        {
          ...session.exerciseGroups[0],
          sets: [{ ...session.exerciseGroups[0].sets[0], set: 3 }],
        },
      ],
    };
    const result = await operationsOn(withGap).appendSet({
      workoutId,
      exerciseId,
      targetReps: 8,
      weight: 60,
    });
    expect(result._unsafeUnwrap().exerciseGroups[0].sets.at(-1)).toMatchObject({
      set: 4,
      targetReps: 8,
      weight: 60,
      reps: undefined,
      isCompleted: false,
    });
  });
});

describe("renameWorkout", () => {
  it("changes only the name", async () => {
    const result = await operationsOn(session).renameWorkout({
      workoutId,
      name: "Upper B",
    });
    expect(result._unsafeUnwrap().workout).toEqual({
      ...session.workout,
      name: "Upper B",
    });
  });
});
