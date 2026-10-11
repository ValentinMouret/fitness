import { describe, expect, it } from "vitest";
import type { Exercise } from "~/modules/fitness/domain/workout";
import {
  createExerciseOptionViewModels,
  formatLastPerformed,
} from "./exercise-option.view-model";

const exercise = (id: string): Exercise => ({
  id,
  name: id,
  type: "barbell",
  movementPattern: "push",
});

describe("createExerciseOptionViewModels", () => {
  const options = createExerciseOptionViewModels(
    [exercise("bench"), exercise("row"), exercise("press")],
    new Map([["row", new Date("2026-10-06T12:00:00Z")]]),
    new Set(["bench"]),
  );

  it("excludes exercises already in the workout", () => {
    expect(options.map((option) => option.id)).toEqual(["row", "press"]);
  });

  it("carries when each exercise was last done", () => {
    expect(options.map((option) => option.lastPerformedAt)).toEqual([
      "2026-10-06T12:00:00.000Z",
      undefined,
    ]);
  });
});

describe("formatLastPerformed", () => {
  it("shows the day or that the exercise is new", () => {
    expect(formatLastPerformed("2026-10-06T12:00:00.000Z")).toBe(
      "Last: Tue 6 Oct",
    );
    expect(formatLastPerformed(undefined)).toBe("Not done before");
  });
});
