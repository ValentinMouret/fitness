import { describe, expect, it } from "vitest";
import { planRepeatedSession } from "./repeat-workout";
import type { WorkoutSession } from "./workout";

const exercise = {
  id: "bench",
  name: "Bench",
  type: "barbell",
  movementPattern: "push",
} as const;

const source: WorkoutSession = {
  workout: { id: "old", name: "Upper A", start: new Date("2026-10-01") },
  exerciseGroups: [
    {
      exercise,
      orderIndex: 0,
      notes: "Pause reps",
      sets: [
        {
          workoutId: "old",
          exerciseId: "bench",
          set: 1,
          reps: 10,
          weight: 40,
          isCompleted: true,
          isFailure: false,
          isWarmup: true,
        },
        {
          workoutId: "old",
          exerciseId: "bench",
          set: 2,
          targetReps: 8,
          reps: 7,
          weight: 80,
          note: "Grindy",
          isCompleted: true,
          isFailure: true,
          isWarmup: false,
          reportedRir: "0",
        },
        {
          workoutId: "old",
          exerciseId: "bench",
          set: 3,
          targetReps: 8,
          weight: 80,
          isCompleted: false,
          isFailure: false,
          isWarmup: false,
        },
      ],
    },
  ],
};

describe("planRepeatedSession", () => {
  const plan = planRepeatedSession(source, {
    id: "new",
    name: "Sunday, 11th",
    start: new Date("2026-10-11"),
  });

  it("plans what was performed and leaves nothing done", () => {
    expect(plan.exerciseGroups[0].sets).toEqual([
      {
        workoutId: "new",
        exerciseId: "bench",
        set: 1,
        targetReps: 10,
        weight: 40,
        isCompleted: false,
        isFailure: false,
        isWarmup: true,
      },
      {
        workoutId: "new",
        exerciseId: "bench",
        set: 2,
        targetReps: 7,
        weight: 80,
        isCompleted: false,
        isFailure: false,
        isWarmup: false,
      },
      {
        workoutId: "new",
        exerciseId: "bench",
        set: 3,
        targetReps: 8,
        weight: 80,
        isCompleted: false,
        isFailure: false,
        isWarmup: false,
      },
    ]);
  });

  it("keeps the exercise order and notes", () => {
    expect(plan.exerciseGroups[0]).toMatchObject({
      orderIndex: 0,
      notes: "Pause reps",
    });
  });
});
