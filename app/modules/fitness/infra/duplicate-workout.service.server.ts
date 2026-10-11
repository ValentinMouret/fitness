import { redirect } from "react-router";
import type { UserId } from "~/modules/auth/domain/user";
import { planRepeatedSession } from "~/modules/fitness/domain/repeat-workout";
import { Workout } from "~/modules/fitness/domain/workout";
import {
  createWorkoutRepository,
  createWorkoutSessionRepository,
} from "~/modules/fitness/infra/workout.repository.server";
import { getOrdinalSuffix } from "~/time";
import { createNotFoundError, handleResultError } from "~/utils/errors";

/**
 * Repeats a workout: starts a new session planned from the source's sets.
 */
export async function duplicateWorkout(
  userId: UserId,
  sourceWorkoutId: string,
): Promise<Response> {
  const sessionResult =
    await createWorkoutSessionRepository(userId).findById(sourceWorkoutId);

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
  const saveResult = await createWorkoutRepository(userId).save(newWorkout);

  if (saveResult.isErr()) {
    handleResultError(saveResult, "Failed to create workout");
  }

  const savedWorkout = saveResult.value;

  const newSession = planRepeatedSession(source, savedWorkout);

  const sessionSaveResult =
    await createWorkoutRepository(userId).saveSession(newSession);

  if (sessionSaveResult.isErr()) {
    handleResultError(sessionSaveResult, "Failed to duplicate workout session");
  }

  return redirect(`/workouts/${savedWorkout.id}`);
}
