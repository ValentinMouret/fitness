import { redirect } from "react-router";
import { AdaptiveWorkoutService } from "~/modules/fitness/application/adaptive-workout-service.server";
import { VolumeTrackingService } from "~/modules/fitness/application/volume-tracking-service.server";
import { AdaptiveWorkoutRepository } from "~/modules/fitness/infra/adaptive-workout-repository.server";
import {
  WorkoutRepository,
  WorkoutSessionRepository,
} from "~/modules/fitness/infra/workout.repository.server";

export async function getGenerateWorkoutData() {
  const availableEquipmentResult =
    await AdaptiveWorkoutRepository.getAvailableEquipment();
  const volumeNeedsResult = await VolumeTrackingService.getVolumeNeeds();
  const progressResult = await VolumeTrackingService.getWeeklyProgress();

  if (availableEquipmentResult.isErr()) {
    throw new Error("Failed to load available equipment");
  }

  if (volumeNeedsResult.isErr()) {
    throw new Error("Failed to load volume needs");
  }

  if (progressResult.isErr()) {
    throw new Error("Failed to load weekly progress");
  }

  return {
    availableEquipment: availableEquipmentResult.value,
    volumeNeeds: Array.from(volumeNeedsResult.value.entries()),
    weeklyProgress: {
      ...progressResult.value,
      progressPercentage: Array.from(
        progressResult.value.progressPercentage.entries(),
      ),
    },
  };
}

export type GenerateWorkoutResult = { readonly error: string } | Response;

export async function generateWorkout(input: {
  readonly targetDuration: number;
  readonly preferredFloor?: string;
  readonly selectedEquipmentIds: string[];
}): Promise<GenerateWorkoutResult> {
  if (!input.targetDuration || input.targetDuration <= 0) {
    return { error: "Please provide a valid target duration" };
  }

  const availableEquipmentResult =
    await AdaptiveWorkoutRepository.getAvailableEquipment();
  if (availableEquipmentResult.isErr()) {
    return { error: "Failed to load equipment data" };
  }

  const selectedEquipmentInstances = availableEquipmentResult.value.filter(
    (equipment) => input.selectedEquipmentIds.includes(equipment.id),
  );

  const volumeNeedsResult = await VolumeTrackingService.getVolumeNeeds();
  if (volumeNeedsResult.isErr()) {
    return { error: "Failed to load volume needs" };
  }

  const workoutResult = await AdaptiveWorkoutService.generateWorkout({
    availableEquipment: selectedEquipmentInstances,
    targetDuration: input.targetDuration,
    preferredFloor: input.preferredFloor
      ? Number(input.preferredFloor)
      : undefined,
    volumeNeeds: volumeNeedsResult.value,
  });

  if (workoutResult.isErr()) {
    return {
      error:
        workoutResult.error === "no_available_equipment"
          ? "No exercises available with selected equipment"
          : workoutResult.error === "insufficient_exercises"
            ? "Not enough exercises found to create a complete workout"
            : "Failed to generate workout",
    };
  }

  // biome-ignore lint/correctness/noUnusedVariables: id is intentionally extracted to exclude it from workoutWithoutId
  const { id, ...workoutWithoutId } = workoutResult.value.workout.workout;
  const savedWorkoutResult = await WorkoutRepository.save(workoutWithoutId);
  if (savedWorkoutResult.isErr()) {
    return { error: "Failed to save workout" };
  }

  const savedWorkout = savedWorkoutResult.value;

  for (const [
    index,
    exerciseGroup,
  ] of workoutResult.value.workout.exerciseGroups.entries()) {
    const addExerciseResult = await WorkoutSessionRepository.addExercise(
      savedWorkout.id,
      exerciseGroup.exercise.id,
      index,
      exerciseGroup.notes,
    );
    if (addExerciseResult.isErr()) {
      return {
        error: `Failed to add exercise: ${exerciseGroup.exercise.name}`,
      };
    }
  }

  return redirect(`/workouts/${savedWorkout.id}`);
}
