import { err, ok, type Result } from "neverthrow";
import { z } from "zod";
import {
  type Exercise,
  exerciseTypes,
  movementPatterns,
  muscleGroups,
  type WorkoutSession,
  WorkoutSet,
} from "./workout";

export type WorkoutError = {
  readonly code: "invalid_input" | "not_found" | "conflict" | "database_error";
  readonly message: string;
};
export const failure = (
  code: WorkoutError["code"],
  message: string,
): WorkoutError => ({ code, message });
const id = z.uuid();
const note = z.string().max(5000).nullable().optional();
const positiveInteger = z.number().int().positive().max(2147483647);
export const setSchema = z
  .object({
    set: positiveInteger.describe(
      "Explicit set number within this workout exercise.",
    ),
    targetReps: positiveInteger.nullable().optional(),
    reps: positiveInteger.nullable().optional(),
    weight: z
      .number()
      .positive()
      .nullable()
      .optional()
      .describe("Kilograms; omit for unweighted/bodyweight sets."),
    note,
    isCompleted: z.boolean().default(false),
    isWarmup: z.boolean().default(false),
    isFailure: z.boolean().default(false),
    rpe: z.number().min(6).max(10).nullable().optional(),
    reportedRir: z
      .enum(["0", "1", "2", "3", "4+", "unsure"])
      .nullable()
      .optional(),
  })
  .strict();
export const setsSchema = z
  .array(setSchema)
  .max(200)
  .refine(
    (sets) => new Set(sets.map((set) => set.set)).size === sets.length,
    "Set numbers must be unique",
  );
export const exerciseInputSchema = z
  .object({ exerciseId: id, notes: note, sets: setsSchema.default([]) })
  .strict();
export const createWorkoutSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    notes: note,
    start: z.iso
      .datetime({ offset: true })
      .optional()
      .describe("ISO timestamp; defaults to now."),
    stop: z.iso
      .datetime({ offset: true })
      .nullable()
      .optional()
      .describe(
        "ISO end timestamp for a completed workout. Does not mark individual sets completed.",
      ),
    exercises: z.array(exerciseInputSchema).max(100).default([]),
  })
  .strict()
  .refine(
    (input) =>
      new Set(input.exercises.map((e) => e.exerciseId)).size ===
      input.exercises.length,
    "An exercise can occur only once in a workout",
  );
export const createExerciseSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    type: z.enum(exerciseTypes),
    movementPattern: z.enum(movementPatterns),
    description: note,
    mmcInstructions: note,
    muscleGroupSplits: z
      .array(
        z
          .object({
            muscleGroup: z.enum(muscleGroups),
            split: z.number().int().min(1).max(100),
          })
          .strict(),
      )
      .min(1)
      .max(muscleGroups.length),
  })
  .strict()
  .refine(
    (input) =>
      input.muscleGroupSplits.reduce((sum, group) => sum + group.split, 0) ===
      100,
    "Muscle contributions must total 100%",
  )
  .refine(
    (input) =>
      new Set(input.muscleGroupSplits.map((g) => g.muscleGroup)).size ===
      input.muscleGroupSplits.length,
    "Muscle groups must be unique",
  );
export const workoutIdSchema = z.object({ workoutId: id }).strict();
export const workoutExerciseSchema = workoutIdSchema.extend({ exerciseId: id });
export const finishWorkoutSchema = workoutIdSchema.extend({
  stop: z.iso.datetime({ offset: true }).optional(),
});
export const addExerciseSchema = workoutExerciseSchema.extend({
  notes: note,
  sets: setsSchema.default([]),
});
export const replaceExerciseSchema = workoutIdSchema.extend({
  oldExerciseId: id,
  newExerciseId: id,
});
export const saveSetsSchema = workoutExerciseSchema.extend({
  sets: setsSchema.refine(
    (sets) => sets.length > 0,
    "Provide at least one set",
  ),
});
export const patchSetSchema = workoutExerciseSchema.extend({
  set: positiveInteger,
  updates: setSchema
    .omit({ set: true, isCompleted: true, isWarmup: true, isFailure: true })
    .partial()
    .extend({
      isCompleted: z.boolean().optional(),
      isWarmup: z.boolean().optional(),
      isFailure: z.boolean().optional(),
    }),
});
export const deleteSetsSchema = workoutExerciseSchema.extend({
  sets: z
    .array(positiveInteger)
    .min(1)
    .max(200)
    .refine(
      (sets) => new Set(sets).size === sets.length,
      "Set numbers must be unique",
    ),
});
export type CreateWorkout = Readonly<z.infer<typeof createWorkoutSchema>>;
export type CreateExercise = Readonly<z.infer<typeof createExerciseSchema>>;
export type SetInput = Readonly<z.infer<typeof setSchema>>;
export type WorkoutId = Readonly<z.infer<typeof workoutIdSchema>>;
export type WorkoutExercise = Readonly<z.infer<typeof workoutExerciseSchema>>;
export type FinishWorkout = Readonly<z.infer<typeof finishWorkoutSchema>>;
export type AddExercise = Readonly<z.infer<typeof addExerciseSchema>>;
export type ReplaceExercise = Readonly<z.infer<typeof replaceExerciseSchema>>;
export type SaveSets = Readonly<z.infer<typeof saveSetsSchema>>;
export type DeleteSets = Readonly<z.infer<typeof deleteSetsSchema>>;
export type PatchSet = Readonly<z.infer<typeof patchSetSchema>>;

export function makeSet(
  workoutId: string,
  exerciseId: string,
  input: SetInput,
): Result<WorkoutSet, WorkoutError> {
  return WorkoutSet.create({
    ...input,
    workout: workoutId,
    exercise: exerciseId,
    targetReps: input.targetReps ?? undefined,
    reps: input.reps ?? undefined,
    weight: input.weight ?? undefined,
    note: input.note ?? undefined,
    rpe: input.rpe ?? undefined,
    reportedRir: input.reportedRir ?? undefined,
  }).mapErr((message) => failure("invalid_input", message));
}

export function replaceSessionExercise(
  session: WorkoutSession,
  oldId: string,
  replacement: Exercise,
): Result<WorkoutSession, WorkoutError> {
  const source = session.exerciseGroups.find(
    (group) => group.exercise.id === oldId,
  );
  if (!source)
    return err(failure("not_found", "Exercise is not in this workout"));
  if (
    session.exerciseGroups.some((group) => group.exercise.id === replacement.id)
  )
    return err(
      failure("conflict", "Replacement exercise is already in this workout"),
    );
  const completed = source.sets.filter((set) => set.isCompleted);
  const pending = source.sets.filter((set) => !set.isCompleted);
  if (completed.length && !pending.length)
    return err(
      failure(
        "conflict",
        "There are no pending sets to replace; add the new exercise instead",
      ),
    );
  const replacementGroup = {
    ...source,
    exercise: replacement,
    sets: pending.map((set, index) => ({
      ...set,
      exerciseId: replacement.id,
      set: index + 1,
      reps: undefined,
      weight: undefined,
      rpe: undefined,
      reportedRir: undefined,
      isFailure: false,
    })),
  };
  const groups = session.exerciseGroups.flatMap((group) =>
    group.exercise.id !== oldId
      ? [group]
      : completed.length
        ? [{ ...source, sets: completed }, replacementGroup]
        : [replacementGroup],
  );
  return ok({
    ...session,
    exerciseGroups: groups.map((group, orderIndex) => ({
      ...group,
      orderIndex,
    })),
  });
}
