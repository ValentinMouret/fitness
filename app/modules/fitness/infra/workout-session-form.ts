import { err, ok, type Result } from "neverthrow";
import { z } from "zod";
import { zfd } from "zod-form-data";
import { reportedRirValues } from "../domain/workout";
import {
  type AppendSet,
  appendSetSchema,
  type DeleteSets,
  deleteSetsSchema,
  type FinishWorkout,
  finishWorkoutSchema,
  type PatchSet,
  patchSetSchema,
  type ReplaceExercise,
  replaceExerciseSchema,
  type WorkoutExercise,
  workoutExerciseSchema,
} from "../domain/workout-commands";

/** A validated submission from the workout session pages. */
export type WorkoutSessionCommand =
  | { readonly intent: "update-name"; readonly name: string }
  | { readonly intent: "add-exercise"; readonly input: WorkoutExercise }
  | {
      readonly intent: "update-exercise-mmc";
      readonly exerciseId: string;
      readonly mmcInstructions?: string;
    }
  | { readonly intent: "remove-exercise"; readonly input: WorkoutExercise }
  | { readonly intent: "replace-exercise"; readonly input: ReplaceExercise }
  | {
      readonly intent: "reorder-exercises";
      readonly exerciseIds: ReadonlyArray<string>;
    }
  | { readonly intent: "add-set"; readonly input: AppendSet }
  | { readonly intent: "update-set"; readonly input: PatchSet }
  | { readonly intent: "remove-set"; readonly input: DeleteSets }
  | { readonly intent: "complete-workout"; readonly input: FinishWorkout }
  | { readonly intent: "delete-workout" }
  | { readonly intent: "duplicate-workout" };

const intents = [
  "update-name",
  "add-exercise",
  "update-exercise-mmc",
  "remove-exercise",
  "replace-exercise",
  "reorder-exercises",
  "add-set",
  "update-set",
  "remove-set",
  "complete-workout",
  "delete-workout",
  "duplicate-workout",
] as const;

const whole = z.string().regex(/^\d+$/).transform(Number);
const decimal = z
  .string()
  .regex(/^\d+(\.\d+)?$/)
  .transform(Number);
const flag = z.enum(["true", "false"]).transform((value) => value === "true");
// An empty field clears the value; an absent field leaves it unchanged.
const clearable = <T extends z.ZodTypeAny>(value: T) =>
  z.union([z.literal("").transform(() => null), value]).optional();

const forms = {
  "update-name": zfd.formData({ name: z.string().trim().min(1).max(200) }),
  exercise: zfd.formData({ exerciseId: z.string() }),
  "update-exercise-mmc": zfd.formData({
    exerciseId: z.uuid(),
    mmcInstructions: z
      .string()
      .trim()
      .max(5000)
      .transform((value) => value || undefined)
      .optional(),
  }),
  "replace-exercise": zfd.formData({
    oldExerciseId: z.string(),
    newExerciseId: z.string(),
  }),
  "reorder-exercises": zfd.formData({
    exerciseIds: zfd.repeatable(z.array(z.uuid()).min(1)),
  }),
  "add-set": zfd.formData({
    exerciseId: z.string(),
    targetReps: whole.optional(),
    weight: decimal.optional(),
  }),
  "update-set": zfd.formData({
    exerciseId: z.string(),
    setNumber: whole,
    reps: clearable(whole),
    weight: clearable(decimal),
    reportedRir: clearable(z.enum(reportedRirValues)),
    isCompleted: flag.optional(),
    isWarmup: flag.optional(),
  }),
  "remove-set": zfd.formData({ exerciseId: z.string(), setNumber: whole }),
};

const parse = <T>(schema: z.ZodType<T>, value: unknown): Result<T, string> => {
  const result = schema.safeParse(value);
  return result.success ? ok(result.data) : err(z.prettifyError(result.error));
};

/** Parses a workout session form into a command for the given workout. */
export function parseWorkoutSessionForm(
  workoutId: string,
  formData: FormData,
): Result<WorkoutSessionCommand, string> {
  return parse(z.enum(intents), formData.get("intent")).andThen(
    (intent): Result<WorkoutSessionCommand, string> => {
      switch (intent) {
        case "update-name":
          return parse(forms[intent], formData).map(({ name }) => ({
            intent,
            name,
          }));
        case "add-exercise":
        case "remove-exercise":
          return parse(forms.exercise, formData)
            .andThen((form) =>
              parse(workoutExerciseSchema, { workoutId, ...form }),
            )
            .map((input) => ({ intent, input }));
        case "update-exercise-mmc":
          return parse(forms[intent], formData).map((form) => ({
            intent,
            ...form,
          }));
        case "replace-exercise":
          return parse(forms[intent], formData)
            .andThen((form) =>
              parse(replaceExerciseSchema, { workoutId, ...form }),
            )
            .map((input) => ({ intent, input }));
        case "reorder-exercises":
          return parse(forms[intent], formData).map(({ exerciseIds }) => ({
            intent,
            exerciseIds,
          }));
        case "add-set":
          return parse(forms[intent], formData)
            .andThen((form) => parse(appendSetSchema, { workoutId, ...form }))
            .map((input) => ({ intent, input }));
        case "update-set":
          return parse(forms[intent], formData)
            .andThen(({ exerciseId, setNumber, ...updates }) =>
              parse(patchSetSchema, {
                workoutId,
                exerciseId,
                set: setNumber,
                updates,
              }),
            )
            .map((input) => ({ intent, input }));
        case "remove-set":
          return parse(forms[intent], formData)
            .andThen(({ exerciseId, setNumber }) =>
              parse(deleteSetsSchema, {
                workoutId,
                exerciseId,
                sets: [setNumber],
              }),
            )
            .map((input) => ({ intent, input }));
        case "complete-workout":
          return parse(finishWorkoutSchema, { workoutId }).map((input) => ({
            intent,
            input,
          }));
        case "delete-workout":
        case "duplicate-workout":
          return ok({ intent });
      }
    },
  );
}
