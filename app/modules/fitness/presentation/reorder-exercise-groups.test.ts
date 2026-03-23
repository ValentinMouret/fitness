import { describe, expect, it } from "vitest";
import type { WorkoutExerciseGroup } from "~/modules/fitness/domain/workout";
import { reorderExerciseGroups } from "./reorder-exercise-groups";

function makeGroup(id: string): WorkoutExerciseGroup {
  return {
    exercise: {
      id,
      name: `Exercise ${id}`,
      type: "barbell",
      movementPattern: "push",
    },
    sets: [],
    orderIndex: 0,
  };
}

describe("reorderExerciseGroups", () => {
  const groups: ReadonlyArray<WorkoutExerciseGroup> = [
    makeGroup("a"),
    makeGroup("b"),
    makeGroup("c"),
  ];

  it("returns null when activeId equals overId", () => {
    expect(reorderExerciseGroups(groups, "a", "a")).toBeNull();
  });

  it("returns null when activeId is not found", () => {
    expect(reorderExerciseGroups(groups, "x", "b")).toBeNull();
  });

  it("returns null when overId is not found", () => {
    expect(reorderExerciseGroups(groups, "a", "x")).toBeNull();
  });

  it("moves first item to second position", () => {
    const result = reorderExerciseGroups(groups, "a", "b");
    expect(result?.map((g) => g.exercise.id)).toEqual(["b", "a", "c"]);
  });

  it("moves last item to first position", () => {
    const result = reorderExerciseGroups(groups, "c", "a");
    expect(result?.map((g) => g.exercise.id)).toEqual(["c", "a", "b"]);
  });

  it("moves middle item to last position", () => {
    const result = reorderExerciseGroups(groups, "b", "c");
    expect(result?.map((g) => g.exercise.id)).toEqual(["a", "c", "b"]);
  });

  it("does not mutate the original array", () => {
    const copy = [...groups];
    reorderExerciseGroups(groups, "a", "c");
    expect(groups.map((g) => g.exercise.id)).toEqual(
      copy.map((g) => g.exercise.id),
    );
  });
});
