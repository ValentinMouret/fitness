import { redirect } from "react-router";
import { Workout } from "~/modules/fitness/domain/workout";
import type { WorkoutSession } from "~/modules/fitness/domain/workout";
import {
  WorkoutRepository,
  WorkoutSessionRepository,
} from "~/modules/fitness/infra/workout.repository.server";
import { getOrdinalSuffix } from "~/time";
import { createNotFoundError, handleResultError } from "~/utils/errors";

/**
 * Duplicates a completed workout: creates a new in-progress workout
 * with the same exercises and sets (weights/reps pre-filled, all uncompleted).
 */
export async function duplicateWorkout(
  sourceWorkoutId: string,
): Promise<Response> {
  const sessionResult =
    await WorkoutSessionRepository.findById(sourceWorkoutId);

  if (sessionResult.isErr()) {
    handleResultError(sessionResult, "Failed to load source workout");
  }

  if (!sessionResult.value) {
    throw createNotFoundError("Workout");
  }

  const source = sessionResult.value;

  const now = new Date();
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  const date = now.getDate();
  const workoutName = `${weekday}, ${date}${getOrdinalSuffix(date)}`;

  const newWorkout = Workout.create({ name: workoutName });
  const saveResult = await WorkoutRepository.save(newWorkout);

  if (saveResult.isErr()) {
    handleResultError(saveResult, "Failed to create workout");
  }

  const savedWorkout = saveResult.value;

  const newSession: WorkoutSession = {
    workout: savedWorkout,
    exerciseGroups: source.exerciseGroups.map((group) => ({
      exercise: group.exercise,
      orderIndex: group.orderIndex,
      notes: group.notes,
      sets: group.sets.map((set) => ({
        workoutId: savedWorkout.id,
        exerciseId: group.exercise.id,
        set: set.set,
        targetReps: set.reps ?? set.targetReps,
        reps: undefined,
        weight: set.weight,
        note: undefined,
        isCompleted: false,
        isFailure: false,
        isWarmup: set.isWarmup,
      })),
    })),
  };

  const sessionSaveResult = await WorkoutRepository.saveSession(newSession);

  if (sessionSaveResult.isErr()) {
    handleResultError(sessionSaveResult, "Failed to duplicate workout session");
  }

  return redirect(`/workouts/${savedWorkout.id}`);
}
