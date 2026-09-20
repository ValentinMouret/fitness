import { describe, expect, it } from "vitest";
import {
  createExerciseSchema,
  createWorkoutSchema,
  saveSetsSchema,
} from "./workout-commands";

const workoutId = "3a12b433-0e67-4c6a-a7c3-38a4b32b955d";
const exerciseId = "62b242cd-862f-4f47-9d88-68bbfb488727";
describe("workout command inputs", () => {
  it.each([
    { set: 1.5 },
    { set: 1, reps: 0 },
    { set: 1, weight: 0 },
    { set: 1, reps: 2.5 },
    { set: 1, rpe: 5 },
    { set: 1, weight: Number.POSITIVE_INFINITY },
  ])("rejects invalid set values %j", (set) => {
    expect(
      saveSetsSchema.safeParse({ workoutId, exerciseId, sets: [set] }).success,
    ).toBe(false);
  });
  it("rejects duplicate identifiers rather than silently overwriting", () => {
    expect(
      saveSetsSchema.safeParse({
        workoutId,
        exerciseId,
        sets: [{ set: 1 }, { set: 1 }],
      }).success,
    ).toBe(false);
    expect(
      createWorkoutSchema.safeParse({
        name: "Duplicate",
        exercises: [{ exerciseId }, { exerciseId }],
      }).success,
    ).toBe(false);
  });
  it("requires unique positive integer muscle percentages totalling 100", () => {
    const exercise = {
      name: "Press",
      type: "dumbbells",
      movementPattern: "push",
    };
    for (const muscleGroupSplits of [
      [{ muscleGroup: "pecs", split: 99 }],
      [
        { muscleGroup: "pecs", split: 50 },
        { muscleGroup: "pecs", split: 50 },
      ],
      [
        { muscleGroup: "pecs", split: 100 },
        { muscleGroup: "triceps", split: 0 },
      ],
    ]) {
      expect(
        createExerciseSchema.safeParse({ ...exercise, muscleGroupSplits })
          .success,
      ).toBe(false);
    }
    expect(
      createExerciseSchema.safeParse({
        ...exercise,
        muscleGroupSplits: [
          { muscleGroup: "pecs", split: 80 },
          { muscleGroup: "triceps", split: 20 },
        ],
      }).success,
    ).toBe(true);
  });
});
