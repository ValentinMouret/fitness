import { describe, expect, it } from "vitest";
import { parseWorkoutSessionForm } from "./workout-session-form";

const workoutId = "3a12b433-0e67-4c6a-a7c3-38a4b32b955d";
const exerciseId = "62b242cd-862f-4f47-9d88-68bbfb488727";
const otherExerciseId = "7c0a3c4e-5b8f-4f43-8a51-3a2b1c0d9e8f";

const form = (
  fields: Readonly<Record<string, string | ReadonlyArray<string> | undefined>>,
) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const entry of typeof value === "string" ? [value] : (value ?? []))
      data.append(key, entry);
  }
  return data;
};

const parse = (fields: Parameters<typeof form>[0]) =>
  parseWorkoutSessionForm(workoutId, form(fields));

const setForm = (fields: Readonly<Record<string, string | undefined>>) =>
  parse({ intent: "update-set", exerciseId, setNumber: "1", ...fields });

describe("parseWorkoutSessionForm", () => {
  it("rejects unknown and missing intents", () => {
    expect(parse({ intent: "cancel-workout" }).isErr()).toBe(true);
    expect(parse({}).isErr()).toBe(true);
  });

  describe("update-set", () => {
    it("parses supplied values and leaves absent fields unchanged", () => {
      expect(
        setForm({
          reps: "8",
          weight: "62.5",
          reportedRir: "4+",
          isCompleted: "true",
        })._unsafeUnwrap(),
      ).toEqual({
        intent: "update-set",
        input: {
          workoutId,
          exerciseId,
          set: 1,
          updates: {
            reps: 8,
            weight: 62.5,
            reportedRir: "4+",
            isCompleted: true,
          },
        },
      });
    });

    it("clears empty fields", () => {
      const command = setForm({
        reps: "",
        weight: "",
        reportedRir: "",
      })._unsafeUnwrap();
      expect(command.intent === "update-set" && command.input.updates).toEqual({
        reps: null,
        weight: null,
        reportedRir: null,
      });
    });

    it("accepts an unsure RIR", () => {
      const command = setForm({ reportedRir: "unsure" })._unsafeUnwrap();
      expect(command.intent === "update-set" && command.input.updates).toEqual({
        reportedRir: "unsure",
      });
    });

    it.each([
      { reps: "10garbage" },
      { reps: "1.5" },
      { reps: "0" },
      { weight: "20kg" },
      { weight: "Infinity" },
      { reportedRir: "5" },
      { reportedRir: "4" },
      { setNumber: "1.5" },
      { isCompleted: "maybe" },
      { exerciseId: "invalid-id" },
    ])("rejects malformed input %j", (fields) => {
      expect(setForm(fields).isErr()).toBe(true);
    });
  });

  it("parses an appended set with an optional plan", () => {
    expect(
      parse({
        intent: "add-set",
        exerciseId,
        targetReps: "8",
        weight: "80",
      })._unsafeUnwrap(),
    ).toEqual({
      intent: "add-set",
      input: { workoutId, exerciseId, targetReps: 8, weight: 80 },
    });
    expect(parse({ intent: "add-set", exerciseId })._unsafeUnwrap()).toEqual({
      intent: "add-set",
      input: { workoutId, exerciseId },
    });
  });

  it("parses a completed set without client-supplied values", () => {
    expect(
      parse({
        intent: "complete-set",
        exerciseId,
        setNumber: "2",
        reps: "99",
      })._unsafeUnwrap(),
    ).toEqual({
      intent: "complete-set",
      input: { workoutId, exerciseId, set: 2 },
    });
  });

  it("parses a removed set into a delete command", () => {
    expect(
      parse({
        intent: "remove-set",
        exerciseId,
        setNumber: "3",
      })._unsafeUnwrap(),
    ).toEqual({
      intent: "remove-set",
      input: { workoutId, exerciseId, sets: [3] },
    });
  });

  it("parses repeated exercise ids for reordering", () => {
    expect(
      parse({
        intent: "reorder-exercises",
        exerciseIds: [otherExerciseId, exerciseId],
      })._unsafeUnwrap(),
    ).toEqual({
      intent: "reorder-exercises",
      exerciseIds: [otherExerciseId, exerciseId],
    });
    expect(parse({ intent: "reorder-exercises" }).isErr()).toBe(true);
  });

  it("rejects replacing an exercise with an invalid id", () => {
    expect(
      parse({
        intent: "replace-exercise",
        oldExerciseId: exerciseId,
        newExerciseId: "nope",
      }).isErr(),
    ).toBe(true);
  });

  it("trims names and rejects blank ones", () => {
    expect(
      parse({ intent: "update-name", name: "  Upper A " })._unsafeUnwrap(),
    ).toEqual({ intent: "update-name", name: "Upper A" });
    expect(parse({ intent: "update-name", name: "  " }).isErr()).toBe(true);
  });

  it("clears an empty mind–muscle cue", () => {
    expect(
      parse({
        intent: "update-exercise-mmc",
        exerciseId,
        mmcInstructions: " ",
      })._unsafeUnwrap(),
    ).toEqual({
      intent: "update-exercise-mmc",
      exerciseId,
      mmcInstructions: undefined,
    });
  });
});
