import { describe, expect, test } from "vitest";
import {
  exerciseEditorUrl,
  parseExerciseReturnTo,
} from "./exercise-editor-navigation";

describe("exercise editor caller return", () => {
  test("retains the session's selection search and replacement state", () => {
    const caller =
      "/workouts/12345678-1234-1234-1234-123456789abc?selectExercise=1&exerciseSearch=row&exerciseType=cable&replaceExerciseId=abc";
    expect(parseExerciseReturnTo(caller)).toBe(caller);
    expect(
      new URL(
        exerciseEditorUrl("exercise", caller),
        "https://fitness.invalid",
      ).searchParams.get("returnTo"),
    ).toBe(caller);
  });
  test.each([
    null,
    "https://evil.invalid",
    "//evil.invalid",
    "/\\evil.invalid",
    "/nutrition",
    "not-a-path",
    "/workouts/exercises/../../logout",
  ])("rejects unsafe or unrelated caller %s", (caller) => {
    expect(parseExerciseReturnTo(caller)).toBe("/workouts/exercises");
  });
  test("retains catalogue filters and discards fragments", () => {
    expect(parseExerciseReturnTo("/workouts/exercises?search=row#x")).toBe(
      "/workouts/exercises?search=row",
    );
  });
});
