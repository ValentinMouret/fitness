import { describe, expect, it } from "vitest";
import { activeWorkoutPatchSchema } from "./active-workout";

const identifiers = {
  workoutId: "00000000-0000-4000-8000-000000000001",
  exerciseId: "00000000-0000-4000-8000-000000000002",
  set: 1,
  expectedRevision: "a".repeat(64),
};
describe("active workout boundary", () => {
  it("accepts explicit unweighted reps and unknown effort", () => {
    expect(
      activeWorkoutPatchSchema.parse({
        ...identifiers,
        updates: {
          weight: null,
          reps: 8,
          reportedRir: "unsure",
          isCompleted: true,
        },
      }).updates,
    ).toEqual({
      weight: null,
      reps: 8,
      reportedRir: "unsure",
      isCompleted: true,
    });
  });
  it.each([
    {},
    { targetReps: 12 },
    { reps: 0 },
    { weight: 0 },
    { reportedRir: "5" },
    { isCompleted: "true" },
  ])("rejects empty, invalid or prescription updates %j", (updates) => {
    expect(
      activeWorkoutPatchSchema.safeParse({ ...identifiers, updates }).success,
    ).toBe(false);
  });
});
