import { redirect } from "react-router";
import { Workout } from "~/modules/fitness/domain/workout";
import type { WorkoutSession } from "~/modules/fitness/domain/workout";
import { WorkoutTemplate } from "~/modules/fitness/domain/workout-template";
import type { WorkoutTemplateWithDetails } from "~/modules/fitness/domain/workout-template";
import { WorkoutTemplateRepository } from "~/modules/fitness/infra/workout-template.repository.server";
import {
  WorkoutRepository,
  WorkoutSessionRepository,
} from "~/modules/fitness/infra/workout.repository.server";
import { getOrdinalSuffix } from "~/time";
import { createNotFoundError, handleResultError } from "~/utils/errors";

export async function createTemplateFromWorkout(
  workoutId: string,
  templateName: string,
): Promise<{ success: true; templateId: string } | { error: string }> {
  const sessionResult = await WorkoutSessionRepository.findById(workoutId);

  if (sessionResult.isErr()) {
    return { error: "Failed to load workout" };
  }

  if (!sessionResult.value) {
    return { error: "Workout not found" };
  }

  const template = WorkoutTemplate.createFromWorkout({
    name: templateName,
    session: sessionResult.value,
  });

  const saveResult = await WorkoutTemplateRepository.save(template);

  if (saveResult.isErr()) {
    return { error: "Failed to save template" };
  }

  return { success: true, templateId: saveResult.value.id };
}

export async function createWorkoutFromTemplate(
  templateId: string,
): Promise<Response> {
  const templateResult = await WorkoutTemplateRepository.findById(templateId);

  if (templateResult.isErr()) {
    handleResultError(templateResult, "Failed to load template");
  }

  if (!templateResult.value) {
    throw createNotFoundError("Template");
  }

  const template = templateResult.value;

  const now = new Date();
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  const date = now.getDate();
  const workoutName = `${weekday}, ${date}${getOrdinalSuffix(date)}`;

  const newWorkout = Workout.create({ name: workoutName, templateId });
  const saveResult = await WorkoutRepository.save(newWorkout);

  if (saveResult.isErr()) {
    handleResultError(saveResult, "Failed to create workout");
  }

  const savedWorkout = saveResult.value;

  const newSession: WorkoutSession = {
    workout: savedWorkout,
    exerciseGroups: template.exercises.map((templateExercise) => {
      const exerciseDetail = template.exerciseDetails.find(
        (e) => e.id === templateExercise.exerciseId,
      );

      const templateSets = template.sets
        .filter((s) => s.exerciseId === templateExercise.exerciseId)
        .sort((a, b) => a.set - b.set);

      return {
        exercise: exerciseDetail ?? {
          id: templateExercise.exerciseId,
          name: "Unknown",
          type: "barbell" as const,
          movementPattern: "push" as const,
        },
        orderIndex: templateExercise.orderIndex,
        notes: templateExercise.notes,
        sets: templateSets.map((s) => ({
          workoutId: savedWorkout.id,
          exerciseId: templateExercise.exerciseId,
          set: s.set,
          targetReps: s.targetReps,
          reps: undefined,
          weight: s.weight,
          note: undefined,
          isCompleted: false,
          isFailure: false,
          isWarmup: s.isWarmup,
        })),
      };
    }),
  };

  const sessionSaveResult = await WorkoutRepository.saveSession(newSession);

  if (sessionSaveResult.isErr()) {
    handleResultError(
      sessionSaveResult,
      "Failed to create workout from template",
    );
  }

  return redirect(`/workouts/${savedWorkout.id}`);
}

export async function getTemplatesForStartDialog(): Promise<
  ReadonlyArray<WorkoutTemplateWithDetails>
> {
  const result = await WorkoutTemplateRepository.findAllWithDetails();

  if (result.isErr()) {
    return [];
  }

  return result.value;
}

export async function deleteTemplate(
  templateId: string,
): Promise<{ success: true } | { error: string }> {
  const result = await WorkoutTemplateRepository.delete(templateId);

  if (result.isErr()) {
    return { error: "Failed to delete template" };
  }

  return { success: true };
}
