import type { Result } from "neverthrow";
import { redirect } from "react-router";
import type { UserId } from "~/modules/auth/domain/user";
import { createExerciseRepository } from "~/modules/fitness/infra/repository.server";
import {
  createWorkoutRepository,
  createWorkoutSessionRepository,
} from "~/modules/fitness/infra/workout.repository.server";
import type { ErrRepository } from "~/repository";
import { createNotFoundError, handleResultError } from "~/utils/errors";
import type { WorkoutError, WorkoutExercise } from "../domain/workout-commands";
import { duplicateWorkout } from "./duplicate-workout.service.server";
import { updateWorkoutExerciseCue } from "./exercise-preferences.repository.server";
import { createWorkoutCommands } from "./workout.repository.server";
import type { WorkoutSessionCommand } from "./workout-session-form";

export async function getWorkoutSessionData(userId: UserId, id: string) {
  const sessions = createWorkoutSessionRepository(userId);
  const workoutSessionResult = await sessions.findById(id);

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

  const lastPerformedResult = await sessions.lastPerformedByExercise();

  if (lastPerformedResult.isErr()) {
    handleResultError(lastPerformedResult, "Failed to load exercise history");
  }

  return {
    workoutSession: workoutSessionResult.value,
    exercises: exercisesResult.value,
    lastPerformed: lastPerformedResult.value,
  };
}

/** Throws a 404 unless the workout exists and belongs to the user. */
export async function requireOwnedWorkout(
  userId: UserId,
  id: string,
): Promise<void> {
  const workout = await createWorkoutRepository(userId).findById(id);
  if (workout.isErr()) handleResultError(workout, "Failed to load workout");
  if (!workout.value) throw createNotFoundError("Workout");
}

export type WorkoutActionResult =
  | { readonly success: true }
  | { readonly error: string }
  | Response;

const outcome = (
  result: Result<unknown, WorkoutError | ErrRepository>,
): WorkoutActionResult =>
  result.isOk()
    ? { success: true }
    : {
        error:
          typeof result.error === "string"
            ? "The workout could not be updated"
            : result.error.message,
      };

/** Adds an exercise with one set planned from its last finished session. */
async function addExerciseToWorkout(
  userId: UserId,
  input: WorkoutExercise,
): Promise<WorkoutActionResult> {
  const history = await createWorkoutSessionRepository(
    userId,
  ).getLastCompletedSetsForExercise(input.exerciseId);
  const last = history.isOk() ? history.value[0] : undefined;
  const result = await createWorkoutCommands(userId).addExercise({
    ...input,
    sets: [
      {
        set: 1,
        targetReps: last?.reps,
        weight: last?.weight,
        isCompleted: false,
        isWarmup: false,
        isFailure: false,
      },
    ],
  });
  if (result.isErr()) return { error: result.error.message };
  return redirect(`/workouts/${input.workoutId}/exercises/${input.exerciseId}`);
}

/** Applies a validated command from the workout session pages. */
export async function runWorkoutSessionCommand(
  userId: UserId,
  workoutId: string,
  command: WorkoutSessionCommand,
): Promise<WorkoutActionResult> {
  const commands = createWorkoutCommands(userId);
  switch (command.intent) {
    case "update-name":
      return outcome(
        await commands.renameWorkout({ workoutId, name: command.name }),
      );
    case "add-exercise":
      return addExerciseToWorkout(userId, command.input);
    case "update-exercise-mmc": {
      const saved = await updateWorkoutExerciseCue(userId, {
        workoutId,
        exerciseId: command.exerciseId,
        mmcInstructions: command.mmcInstructions,
      });
      if (!saved) throw createNotFoundError("Workout exercise");
      return { success: true };
    }
    case "remove-exercise": {
      const result = await commands.removeExercise(command.input);
      if (result.isErr()) return { error: result.error.message };
      return redirect(`/workouts/${workoutId}`);
    }
    case "replace-exercise": {
      const result = await commands.replaceExercise(command.input);
      if (result.isErr()) return { error: result.error.message };
      return redirect(
        `/workouts/${workoutId}/exercises/${command.input.newExerciseId}`,
      );
    }
    case "reorder-exercises":
      return outcome(
        await createWorkoutSessionRepository(userId).reorderExercises(
          workoutId,
          [...command.exerciseIds],
        ),
      );
    case "add-set":
      return outcome(await commands.appendSet(command.input));
    case "complete-set":
      return outcome(await commands.completeSet(command.input));
    case "update-set":
      return outcome(await commands.updateSet(command.input));
    case "remove-set":
      return outcome(await commands.deleteSets(command.input));
    case "complete-workout":
      return outcome(await commands.finishWorkout(command.input));
    case "delete-workout": {
      const result = await commands.deleteWorkout({ workoutId });
      if (result.isErr()) return { error: result.error.message };
      return redirect("/workouts");
    }
    case "duplicate-workout":
      return duplicateWorkout(userId, workoutId);
  }
}
