import { describe, expect, it } from "vitest";
import { WorkoutSet } from "./workout";

describe("WorkoutSet.create", () => {
  const baseInput = {
    workout: "w-1",
    exercise: "ex-1",
    set: 1,
    reps: 10,
    weight: 80,
  };

  it("accepts exercise as string (id)", () => {
    const result = WorkoutSet.create({ ...baseInput, exercise: "ex-1" });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.exerciseId).toBe("ex-1");
    }
  });

  it("accepts exercise as Exercise object", () => {
    const result = WorkoutSet.create({
      ...baseInput,
      exercise: {
        id: "ex-2",
        name: "Squat",
        type: "barbell",
        movementPattern: "squat",
      },
    });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.exerciseId).toBe("ex-2");
    }
  });

  it("accepts workout as string (id)", () => {
    const result = WorkoutSet.create(baseInput);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.workoutId).toBe("w-1");
    }
  });

  it("rejects set number <= 0", () => {
    const result = WorkoutSet.create({ ...baseInput, set: 0 });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBe("Invalid set");
    }
  });

  it("rejects negative reps", () => {
    const result = WorkoutSet.create({ ...baseInput, reps: -1 });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBe("Invalid reps");
    }
  });

  it("rejects negative weight", () => {
    const result = WorkoutSet.create({ ...baseInput, weight: -5 });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBe("Invalid weight");
    }
  });

  it("rejects negative targetReps", () => {
    const result = WorkoutSet.create({ ...baseInput, targetReps: -1 });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBe("Invalid target reps");
    }
  });

  it("defaults boolean fields to false", () => {
    const result = WorkoutSet.create(baseInput);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.isCompleted).toBe(false);
      expect(result.value.isFailure).toBe(false);
      expect(result.value.isWarmup).toBe(false);
    }
  });

  it("allows optional fields to be undefined", () => {
    const result = WorkoutSet.create({
      workout: "w-1",
      exercise: "ex-1",
      set: 1,
    });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.reps).toBeUndefined();
      expect(result.value.weight).toBeUndefined();
      expect(result.value.note).toBeUndefined();
      expect(result.value.rpe).toBeUndefined();
    }
  });
});
