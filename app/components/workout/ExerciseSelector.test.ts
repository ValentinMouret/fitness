import { describe, expect, it } from "vitest";
import { exerciseTypes } from "~/modules/fitness/domain/workout";

/**
 * The ExerciseSelector uses type filter values that must match domain ExerciseType values.
 * This test ensures they stay in sync (previously "dumbbell" was used instead of "dumbbells").
 */
const EXERCISE_SELECTOR_FILTER_VALUES = [
  "barbell",
  "dumbbells",
  "bodyweight",
  "machine",
  "cable",
] as const;

describe("ExerciseSelector filter values", () => {
  it("should all be valid ExerciseType values", () => {
    for (const value of EXERCISE_SELECTOR_FILTER_VALUES) {
      expect(exerciseTypes).toContain(value);
    }
  });

  it("should cover all ExerciseType values", () => {
    for (const type of exerciseTypes) {
      expect(EXERCISE_SELECTOR_FILTER_VALUES).toContain(type);
    }
  });
});
