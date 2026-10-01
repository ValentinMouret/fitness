import { updateWorkoutExerciseCue } from "./exercise-preferences.repository.server";
import { redirect } from "react-router";
import { z } from "zod";
import type { UserId } from "~/modules/auth/domain/user";
import {
  type ReportedRir,
  reportedRirValues,
  type Workout,
  WorkoutSet,
} from "~/modules/fitness/domain/workout";
import { createExerciseRepository } from "~/modules/fitness/infra/repository.server";
import {
  createWorkoutRepository,
  createWorkoutSessionRepository,
} from "~/modules/fitness/infra/workout.repository.server";
import { createNotFoundError, handleResultError } from "~/utils/errors";
import {
  addExerciseSchema,
  deleteSetsSchema,
  finishWorkoutSchema,
  patchSetSchema,
  replaceExerciseSchema,
  saveSetsSchema,
  workoutExerciseSchema,
  workoutIdSchema,
} from "../domain/workout-commands";
import { createWorkoutCommands } from "./workout.repository.server";

export async function getWorkoutSessionData(userId: UserId, id: string) {
  const workoutSessionResult =
    await createWorkoutSessionRepository(userId).findById(id);

  if (workoutSessionResult.isErr()) {
    handleResultError(workoutSessionResult, "Failed to load workout");
  }

  if (!workoutSessionResult.value) {
    throw createNotFoundError("Workout");
  }

  const exercisesResult = await createExerciseRepository(userId).listAll();

  if (exercisesResult.isErr()) {
    handleResultError(exercisesResult, "Failed to load exercises");
  }

  return {
    workoutSession: workoutSessionResult.value,
    exercises: exercisesResult.value,
  };
}

export type WorkoutActionResult =
  | { readonly success: true }
  | { readonly error: string }
  | Response;

export async function updateWorkoutName(
  userId: UserId,
  id: string,
  name: string | undefined,
): Promise<WorkoutActionResult> {
  if (!name || !name.trim()) {
    return { error: "Name is required" };
  }

  const workoutResult = await createWorkoutRepository(userId).findById(id);
  if (workoutResult.isErr() || !workoutResult.value) {
    return { error: "Workout not found" };
  }

  const updatedWorkout: Workout = {
    ...workoutResult.value,
    name: name.trim(),
  };
  const result = await createWorkoutRepository(userId).save(updatedWorkout);

  if (result.isErr()) {
    return { error: "Failed to update workout name" };
  }

  return { success: true };
}

export async function addExerciseToWorkout(
  userId: UserId,
  input: {
    readonly workoutId: string;
    readonly exerciseId?: string;
    readonly notes?: string;
  },
): Promise<WorkoutActionResult> {
  if (!input.exerciseId) {
    return { error: "Exercise ID is required" };
  }

  const parsed = addExerciseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.message };

  const workoutSessionResult = await createWorkoutSessionRepository(
    userId,
  ).findById(parsed.data.workoutId);
  if (workoutSessionResult.isErr() || !workoutSessionResult.value) {
    return { error: "Workout not found" };
  }

  const historicalResult = await createWorkoutSessionRepository(
    userId,
  ).getLastCompletedSetsForExercise(parsed.data.exerciseId);
  const defaultSetValues =
    historicalResult.isOk() && historicalResult.value.length > 0
      ? {
          reps: historicalResult.value[0].reps,
          weight: historicalResult.value[0].weight,
        }
      : undefined;

  const result = await createWorkoutSessionRepository(userId).addExercise(
    parsed.data.workoutId,
    parsed.data.exerciseId,
    parsed.data.notes ?? undefined,
    defaultSetValues,
  );

  if (result.isErr()) {
    return { error: "Failed to add exercise" };
  }

  return { success: true };
}

export async function addExercisesToWorkout(
  userId: UserId,
  input: {
    readonly workoutId: string;
    readonly exerciseIds: ReadonlyArray<string>;
  },
): Promise<WorkoutActionResult> {
  if (input.exerciseIds.length === 0) {
    return { error: "At least one exercise ID is required" };
  }

  const parsed = workoutIdSchema
    .extend({
      exerciseIds: z.array(z.uuid()).min(1).max(100),
    })
    .safeParse(input);
  if (!parsed.success) return { error: parsed.error.message };

  const workoutSessionResult = await createWorkoutSessionRepository(
    userId,
  ).findById(parsed.data.workoutId);
  if (workoutSessionResult.isErr() || !workoutSessionResult.value) {
    return { error: "Workout not found" };
  }

  for (const exerciseId of parsed.data.exerciseIds) {
    const historicalResult =
      await createWorkoutSessionRepository(
        userId,
      ).getLastCompletedSetsForExercise(exerciseId);
    const defaultSetValues =
      historicalResult.isOk() && historicalResult.value.length > 0
        ? {
            reps: historicalResult.value[0].reps,
            weight: historicalResult.value[0].weight,
          }
        : undefined;

    const result = await createWorkoutSessionRepository(userId).addExercise(
      parsed.data.workoutId,
      exerciseId,
      undefined,
      defaultSetValues,
    );

    if (result.isErr()) {
      return { error: "Failed to add exercises" };
    }
  }

  return { success: true };
}

export async function updateExerciseNotes(
  userId: UserId,
  input: {
    readonly workoutId: string;
    readonly exerciseId: string;
    readonly notes: string | null;
  },
): Promise<WorkoutActionResult> {
  const result = await createWorkoutSessionRepository(
    userId,
  ).updateExerciseNotes(input.workoutId, input.exerciseId, input.notes);

  if (result.isErr()) {
    return { error: "Failed to update exercise notes" };
  }

  return { success: true };
}

export async function removeExerciseFromWorkout(
  userId: UserId,
  input: {
    readonly workoutId: string;
    readonly exerciseId?: string;
  },
): Promise<WorkoutActionResult> {
  if (!input.exerciseId) {
    return { error: "Exercise ID is required" };
  }

  const parsed = workoutExerciseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.message };
  const result = await createWorkoutCommands(userId).removeExercise(
    parsed.data,
  );

  if (result.isErr()) {
    return { error: "Failed to remove exercise" };
  }

  return { success: true };
}

export async function addSetToWorkout(
  userId: UserId,
  input: {
    readonly workoutId: string;
    readonly exerciseId?: string;
    readonly repsStr?: string;
    readonly weightStr?: string;
    readonly note?: string;
  },
): Promise<WorkoutActionResult> {
  if (!input.exerciseId) {
    return { error: "Exercise ID is required" };
  }

  const identifiers = workoutExerciseSchema.safeParse({
    workoutId: input.workoutId,
    exerciseId: input.exerciseId,
  });
  if (!identifiers.success) return { error: identifiers.error.message };

  const workoutSessionResult = await createWorkoutSessionRepository(
    userId,
  ).findById(input.workoutId);
  if (workoutSessionResult.isErr() || !workoutSessionResult.value) {
    return { error: "Workout not found" };
  }

  const exerciseGroup = workoutSessionResult.value.exerciseGroups.find(
    (g) => g.exercise.id === input.exerciseId,
  );
  if (!exerciseGroup) {
    return { error: "Exercise not found in workout" };
  }

  const setNumberResult = await createWorkoutSessionRepository(
    userId,
  ).getNextAvailableSetNumber(input.workoutId, input.exerciseId);
  if (setNumberResult.isErr()) {
    return { error: "Failed to determine set number" };
  }
  const setNumber = setNumberResult.value;

  const reps = input.repsStr ? Number(input.repsStr) : undefined;
  const weight = input.weightStr ? Number(input.weightStr) : undefined;

  if (
    input.repsStr &&
    reps !== undefined &&
    (Number.isNaN(reps) || reps <= 0)
  ) {
    return { error: "Reps must be a positive number" };
  }

  if (
    input.weightStr &&
    weight !== undefined &&
    (Number.isNaN(weight) || weight <= 0)
  ) {
    return { error: "Weight must be a positive number" };
  }

  const workoutSetResult = WorkoutSet.create({
    workout: input.workoutId,
    exercise: input.exerciseId,
    set: setNumber,
    reps,
    weight,
    note: input.note,
  });

  if (workoutSetResult.isErr()) {
    return { error: "Invalid set data" };
  }

  const parsed = saveSetsSchema.safeParse({
    workoutId: input.workoutId,
    exerciseId: input.exerciseId,
    sets: [
      {
        set: setNumber,
        reps,
        weight,
        note: input.note,
      },
    ],
  });
  if (!parsed.success) return { error: parsed.error.message };
  const result = await createWorkoutCommands(userId).saveSets(parsed.data);

  if (result.isErr()) {
    return { error: "Failed to add set" };
  }

  return { success: true };
}

type SetUpdate = {
  reps?: number;
  weight?: number;
  note?: string;
  rpe?: number;
  reportedRir?: ReportedRir | null;
  isCompleted?: boolean;
  isWarmup?: boolean;
};

export async function updateSetInWorkout(
  userId: UserId,
  input: {
    readonly workoutId: string;
    readonly exerciseId?: string;
    readonly setNumberStr?: string;
    readonly repsStr?: string;
    readonly weightStr?: string;
    readonly note?: string;
    readonly rpeStr?: string;
    readonly reportedRirStr?: string;
    readonly isCompletedStr?: string;
    readonly isWarmupStr?: string;
  },
): Promise<WorkoutActionResult> {
  if (!input.exerciseId || !input.setNumberStr) {
    return { error: "Exercise ID and set number are required" };
  }

  const setNumber = Number(input.setNumberStr);
  if (Number.isNaN(setNumber) || setNumber <= 0) {
    return { error: "Set number must be a positive integer" };
  }

  const updateData: SetUpdate = {};

  if (input.repsStr !== undefined) {
    const reps = Number(input.repsStr);
    if (input.repsStr === "" || reps === 0) {
      // Leave undefined to avoid updating the field.
    } else if (Number.isNaN(reps) || reps < 0) {
      return { error: "Reps must be a positive number" };
    } else {
      updateData.reps = reps;
    }
  }

  if (input.weightStr !== undefined) {
    const weight = Number(input.weightStr);
    if (input.weightStr === "" || weight === 0) {
      // Leave undefined to avoid updating the field.
    } else if (Number.isNaN(weight) || weight < 0) {
      return { error: "Weight must be a positive number" };
    } else {
      updateData.weight = weight;
    }
  }

  if (input.rpeStr !== undefined) {
    const rpe = Number(input.rpeStr);
    if (input.rpeStr === "") {
      // Leave undefined to avoid updating the field.
    } else if (Number.isNaN(rpe) || rpe < 6 || rpe > 10) {
      return { error: "RPE must be between 6 and 10" };
    } else {
      updateData.rpe = rpe;
    }
  }

  if (input.reportedRirStr !== undefined) {
    if (input.reportedRirStr === "clear") {
      updateData.reportedRir = null;
    } else {
      const parsed = z.enum(reportedRirValues).safeParse(input.reportedRirStr);
      if (!parsed.success) return { error: "Invalid reported effort" };
      updateData.reportedRir = parsed.data;
    }
  }

  if (input.note !== undefined && input.note !== "") {
    updateData.note = input.note;
  }

  if (input.isCompletedStr !== undefined) {
    const parsed = z.enum(["true", "false"]).safeParse(input.isCompletedStr);
    if (!parsed.success) return { error: "Invalid completion value" };
    updateData.isCompleted = parsed.data === "true";
  }

  if (input.isWarmupStr !== undefined) {
    const parsed = z.enum(["true", "false"]).safeParse(input.isWarmupStr);
    if (!parsed.success) return { error: "Invalid warm-up value" };
    updateData.isWarmup = parsed.data === "true";
  }

  const parsed = patchSetSchema.safeParse({
    workoutId: input.workoutId,
    exerciseId: input.exerciseId,
    set: setNumber,
    updates: updateData,
  });
  if (!parsed.success) return { error: parsed.error.message };
  const result = await createWorkoutCommands(userId).updateSet(parsed.data);

  if (result.isErr()) {
    return { error: "Failed to update set" };
  }

  return { success: true };
}

export async function replaceExerciseInWorkout(
  userId: UserId,
  input: {
    readonly workoutId: string;
    readonly oldExerciseId?: string;
    readonly newExerciseId?: string;
  },
): Promise<WorkoutActionResult> {
  if (!input.oldExerciseId || !input.newExerciseId) {
    return { error: "Both old and new exercise IDs are required" };
  }

  const parsed = replaceExerciseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.message };
  const result = await createWorkoutCommands(userId).replaceExercise(
    parsed.data,
  );

  if (result.isErr()) {
    return { error: result.error.message };
  }

  return { success: true };
}

export async function reorderExercisesInWorkout(
  userId: UserId,
  input: {
    readonly workoutId: string;
    readonly exerciseIds: ReadonlyArray<string>;
  },
): Promise<WorkoutActionResult> {
  if (input.exerciseIds.length === 0) {
    return { error: "Exercise IDs are required" };
  }

  const result = await createWorkoutSessionRepository(userId).reorderExercises(
    input.workoutId,
    [...input.exerciseIds],
  );

  if (result.isErr()) {
    return { error: "Failed to reorder exercises" };
  }

  return { success: true };
}

export async function removeSetFromWorkout(
  userId: UserId,
  input: {
    readonly workoutId: string;
    readonly exerciseId?: string;
    readonly setNumberStr?: string;
  },
): Promise<WorkoutActionResult> {
  if (!input.exerciseId || !input.setNumberStr) {
    return { error: "Exercise ID and set number are required" };
  }

  const setNumber = Number(input.setNumberStr);
  if (Number.isNaN(setNumber) || setNumber <= 0) {
    return { error: "Set number must be a positive integer" };
  }

  const parsed = deleteSetsSchema.safeParse({
    workoutId: input.workoutId,
    exerciseId: input.exerciseId,
    sets: [setNumber],
  });
  if (!parsed.success) return { error: parsed.error.message };
  const result = await createWorkoutCommands(userId).deleteSets(parsed.data);

  if (result.isErr()) {
    return { error: "Failed to remove set" };
  }

  return { success: true };
}

export async function completeWorkout(
  userId: UserId,
  input: {
    readonly workoutId: string;
  },
): Promise<WorkoutActionResult> {
  const parsed = finishWorkoutSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.message };
  const result = await createWorkoutCommands(userId).finishWorkout(parsed.data);
  if (result.isErr()) return { error: result.error.message };

  return redirect("/dashboard");
}

export async function destroyWorkout(
  userId: UserId,
  input: {
    readonly workoutId: string;
  },
): Promise<WorkoutActionResult> {
  const parsed = workoutIdSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.message };
  const result = await createWorkoutCommands(userId).deleteWorkout(parsed.data);
  if (result.isErr()) return { error: result.error.message };

  return redirect("/workouts");
}

export async function updateExerciseMmcInstructions(
  userId: UserId,
  input: {
    readonly workoutId: string;
    readonly exerciseId: string;
    readonly mmcInstructions?: string;
  },
): Promise<WorkoutActionResult> {
  const saved = await updateWorkoutExerciseCue(userId, input);
  if (!saved) throw createNotFoundError("Workout exercise");
  return { success: true };
}
