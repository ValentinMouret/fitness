import { describe, expect, it } from "vitest";
import type { WorkoutExerciseGroup } from "~/modules/fitness/domain/workout";
import { createWorkoutProgressViewModel } from "./workout-progress.view-model";

function group(
  id: string,
  completed: readonly boolean[],
): WorkoutExerciseGroup {
  return {
    exercise: { id, name: id, type: "cable", movementPattern: "pull" },
    orderIndex: 0,
    sets: completed.map((isCompleted, index) => ({
      workoutId: "workout",
      exerciseId: id,
      set: index + 1,
      isCompleted,
      isWarmup: false,
      isFailure: false,
    })),
  };
}
describe("workout progress", () => {
  it("does not suggest finishing an empty session or exercise", () => {
    for (const groups of [[], [group("empty", [])]]) {
      expect(createWorkoutProgressViewModel(groups)).toMatchObject({
        totalSets: 0,
        completedSets: 0,
        percent: 0,
        allSetsCompleted: false,
      });
    }
    expect(
      createWorkoutProgressViewModel([group("empty", [])]).exercises[0]
        .isCompleted,
    ).toBe(false);
  });
  it("counts every exercise so the last displayed exercise cannot imply readiness", () => {
    expect(
      createWorkoutProgressViewModel([
        group("first", [false]),
        group("last", [true, true]),
      ]),
    ).toMatchObject({
      totalSets: 3,
      completedSets: 2,
      unfinishedSets: 1,
      allSetsCompleted: false,
      exercises: [
        { completedSets: 0, totalSets: 1, isCompleted: false },
        { completedSets: 2, totalSets: 2, isCompleted: true },
      ],
    });
  });
  it("recognizes all saved sets and invalidates readiness when another is planned", () => {
    expect(
      createWorkoutProgressViewModel([
        group("first", [true]),
        group("last", [true]),
      ]),
    ).toMatchObject({
      allSetsCompleted: true,
      percent: 100,
      unfinishedSets: 0,
    });
    expect(
      createWorkoutProgressViewModel([
        group("first", [true]),
        group("last", [true, false]),
      ]),
    ).toMatchObject({ allSetsCompleted: false, unfinishedSets: 1 });
  });
});
