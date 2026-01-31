import { redirect } from "react-router";
import { type Workout, WorkoutSet } from "~/modules/fitness/domain/workout";
import { ExerciseRepository } from "~/modules/fitness/infra/repository.server";
import {
  WorkoutRepository,
  WorkoutSessionRepository,
} from "~/modules/fitness/infra/workout.repository.server";
import { createNotFoundError, handleResultError } from "~/utils/errors";

export async function getWorkoutSessionData(id: string) {
  const workoutSessionResult = await WorkoutSessionRepository.findById(id);

  if (workoutSessionResult.isErr()) {
    handleResultError(workoutSessionResult, "Failed to load workout");
  }

  if (!workoutSessionResult.value) {
    throw createNotFoundError("Workout");
  }

  const exercisesResult = await ExerciseRepository.listAll();

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
  id: string,
  name: string | undefined,
): Promise<WorkoutActionResult> {
  if (!name || !name.trim()) {
    return { error: "Name is required" };
  }

  const workoutResult = await WorkoutRepository.findById(id);
  if (workoutResult.isErr() || !workoutResult.value) {
    return { error: "Workout not found" };
  }

  const updatedWorkout: Workout = {
    ...workoutResult.value,
    name: name.trim(),
  };
  const result = await WorkoutRepository.save(updatedWorkout);

  if (result.isErr()) {
    return { error: "Failed to update workout name" };
  }

  return { success: true };
}

export async function addExerciseToWorkout(input: {
  readonly workoutId: string;
  readonly exerciseId?: string;
  readonly notes?: string;
}): Promise<WorkoutActionResult> {
  if (!input.exerciseId) {
    return { error: "Exercise ID is required" };
  }

  const workoutSessionResult = await WorkoutSessionRepository.findById(
    input.workoutId,
  );
  if (workoutSessionResult.isErr() || !workoutSessionResult.value) {
    return { error: "Workout not found" };
  }

  const maxOrderIndex = Math.max(
    ...workoutSessionResult.value.exerciseGroups.map((g) => g.orderIndex),
    -1,
  );

  const historicalResult =
    await WorkoutSessionRepository.getLastCompletedSetsForExercise(
      input.exerciseId,
    );
  const defaultSetValues =
    historicalResult.isOk() && historicalResult.value.length > 0
      ? {
          reps: historicalResult.value[0].reps,
          weight: historicalResult.value[0].weight,
        }
      : undefined;

  const result = await WorkoutSessionRepository.addExercise(
    input.workoutId,
    input.exerciseId,
    maxOrderIndex + 1,
    input.notes,
    defaultSetValues,
  );

  if (result.isErr()) {
    return { error: "Failed to add exercise" };
  }

  return { success: true };
}

export async function removeExerciseFromWorkout(input: {
  readonly workoutId: string;
  readonly exerciseId?: string;
}): Promise<WorkoutActionResult> {
  if (!input.exerciseId) {
    return { error: "Exercise ID is required" };
  }

  const result = await WorkoutSessionRepository.removeExercise(
    input.workoutId,
    input.exerciseId,
  );

  if (result.isErr()) {
    return { error: "Failed to remove exercise" };
  }

  return { success: true };
}

export async function addSetToWorkout(input: {
  readonly workoutId: string;
  readonly exerciseId?: string;
  readonly repsStr?: string;
  readonly weightStr?: string;
  readonly note?: string;
}): Promise<WorkoutActionResult> {
  if (!input.exerciseId) {
    return { error: "Exercise ID is required" };
  }

  const workoutSessionResult = await WorkoutSessionRepository.findById(
    input.workoutId,
  );
  if (workoutSessionResult.isErr() || !workoutSessionResult.value) {
    return { error: "Workout not found" };
  }

  const exerciseGroup = workoutSessionResult.value.exerciseGroups.find(
    (g) => g.exercise.id === input.exerciseId,
  );
  if (!exerciseGroup) {
    return { error: "Exercise not found in workout" };
  }

  const setNumberResult =
    await WorkoutSessionRepository.getNextAvailableSetNumber(
      input.workoutId,
      input.exerciseId,
    );
  if (setNumberResult.isErr()) {
    return { error: "Failed to determine set number" };
  }
  const setNumber = setNumberResult.value;

  const reps = input.repsStr ? Number.parseInt(input.repsStr, 10) : undefined;
  const weight = input.weightStr
    ? Number.parseFloat(input.weightStr)
    : undefined;

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
    exercise: {
      id: input.exerciseId,
      name: "",
      type: "barbell",
      movementPattern: "push",
    },
    set: setNumber,
    reps,
    weight,
    note: input.note,
  });

  if (workoutSetResult.isErr()) {
    return { error: "Invalid set data" };
  }

  const result = await WorkoutSessionRepository.addSet(workoutSetResult.value);

  if (result.isErr()) {
    return { error: "Failed to add set" };
  }

  return { success: true };
}

type SetUpdate = {
  reps?: number;
  weight?: number;
  note?: string;
  isCompleted?: boolean;
};

export async function updateSetInWorkout(input: {
  readonly workoutId: string;
  readonly exerciseId?: string;
  readonly setNumberStr?: string;
  readonly repsStr?: string;
  readonly weightStr?: string;
  readonly note?: string;
  readonly isCompletedStr?: string;
}): Promise<WorkoutActionResult> {
  if (!input.exerciseId || !input.setNumberStr) {
    return { error: "Exercise ID and set number are required" };
  }

  const setNumber = Number.parseInt(input.setNumberStr, 10);
  if (Number.isNaN(setNumber) || setNumber <= 0) {
    return { error: "Set number must be a positive integer" };
  }

  const updateData: SetUpdate = {};

  if (input.repsStr !== undefined) {
    const reps = Number.parseInt(input.repsStr, 10);
    if (input.repsStr === "" || reps === 0) {
      // Leave undefined to avoid updating the field.
    } else if (Number.isNaN(reps) || reps < 0) {
      return { error: "Reps must be a positive number" };
    } else {
      updateData.reps = reps;
    }
  }

  if (input.weightStr !== undefined) {
    const weight = Number.parseFloat(input.weightStr);
    if (input.weightStr === "" || weight === 0) {
      // Leave undefined to avoid updating the field.
    } else if (Number.isNaN(weight) || weight < 0) {
      return { error: "Weight must be a positive number" };
    } else {
      updateData.weight = weight;
    }
  }

  if (input.note !== undefined && input.note !== "") {
    updateData.note = input.note;
  }

  if (input.isCompletedStr !== undefined) {
    updateData.isCompleted = input.isCompletedStr === "true";
  }

  const result = await WorkoutSessionRepository.updateSet(
    input.workoutId,
    input.exerciseId,
    setNumber,
    updateData,
  );

  if (result.isErr()) {
    return { error: "Failed to update set" };
  }

  return { success: true };
}

export async function completeSetInWorkout(input: {
  readonly workoutId: string;
  readonly exerciseId?: string;
  readonly setNumberStr?: string;
}): Promise<WorkoutActionResult> {
  if (!input.exerciseId || !input.setNumberStr) {
    return { error: "Exercise ID and set number are required" };
  }

  const setNumber = Number.parseInt(input.setNumberStr, 10);
  if (Number.isNaN(setNumber) || setNumber <= 0) {
    return { error: "Set number must be a positive integer" };
  }

  const result = await WorkoutSessionRepository.updateSet(
    input.workoutId,
    input.exerciseId,
    setNumber,
    { isCompleted: true },
  );

  if (result.isErr()) {
    return { error: "Failed to complete set" };
  }

  return { success: true };
}

export async function removeSetFromWorkout(input: {
  readonly workoutId: string;
  readonly exerciseId?: string;
  readonly setNumberStr?: string;
}): Promise<WorkoutActionResult> {
  if (!input.exerciseId || !input.setNumberStr) {
    return { error: "Exercise ID and set number are required" };
  }

  const setNumber = Number.parseInt(input.setNumberStr, 10);
  if (Number.isNaN(setNumber) || setNumber <= 0) {
    return { error: "Set number must be a positive integer" };
  }

  const result = await WorkoutSessionRepository.removeSet(
    input.workoutId,
    input.exerciseId,
    setNumber,
  );

  if (result.isErr()) {
    return { error: "Failed to remove set" };
  }

  return { success: true };
}

export async function completeWorkout(input: {
  readonly workoutId: string;
}): Promise<WorkoutActionResult> {
  const workoutResult = await WorkoutRepository.findById(input.workoutId);
  if (workoutResult.isErr() || !workoutResult.value) {
    return { error: "Workout not found" };
  }

  const completedWorkout: Workout = {
    ...workoutResult.value,
    stop: new Date(),
  };
  const result = await WorkoutRepository.save(completedWorkout);

  if (result.isErr()) {
    return { error: "Failed to complete workout" };
  }

  return redirect("/dashboard");
}

export async function cancelWorkout(input: {
  readonly workoutId: string;
}): Promise<WorkoutActionResult> {
  const result = await WorkoutRepository.delete(input.workoutId);

  if (result.isErr()) {
    return { error: "Failed to cancel workout" };
  }

  return redirect("/workouts");
}

export async function deleteWorkout(input: {
  readonly workoutId: string;
}): Promise<WorkoutActionResult> {
  const result = await WorkoutRepository.delete(input.workoutId);

  if (result.isErr()) {
    return { error: "Failed to delete workout" };
  }

  return redirect("/workouts");
}
