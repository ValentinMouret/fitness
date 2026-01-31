import { redirect } from "react-router";
import { AdaptiveWorkoutService } from "~/modules/fitness/application/adaptive-workout-service.server";
import { AdaptiveWorkoutRepository } from "~/modules/fitness/infra/adaptive-workout-repository.server";

export async function getSubstituteExerciseData(input: {
  readonly workoutId: string;
  readonly exerciseId: string;
}) {
  const availableEquipmentResult =
    await AdaptiveWorkoutRepository.getAvailableEquipment();
  if (availableEquipmentResult.isErr()) {
    throw new Error("Failed to load available equipment");
  }

  const substitutesResult = await AdaptiveWorkoutRepository.findSubstitutes(
    input.exerciseId,
  );
  if (substitutesResult.isErr()) {
    throw new Error("Failed to load exercise substitutes");
  }

  return {
    workoutId: input.workoutId,
    exerciseId: input.exerciseId,
    availableEquipment: availableEquipmentResult.value,
    potentialSubstitutes: substitutesResult.value,
  };
}

export async function substituteExercise(input: {
  readonly workoutId: string;
  readonly exerciseId: string;
  readonly selectedEquipmentIds: string[];
}) {
  const availableEquipmentResult =
    await AdaptiveWorkoutRepository.getAvailableEquipment();
  if (availableEquipmentResult.isErr()) {
    throw new Error("Failed to load equipment data");
  }

  const selectedEquipmentInstances = availableEquipmentResult.value.filter(
    (equipment) => input.selectedEquipmentIds.includes(equipment.id),
  );

  const substituteResult = await AdaptiveWorkoutService.replaceExercise(
    input.workoutId,
    input.exerciseId,
    selectedEquipmentInstances,
  );

  if (substituteResult.isErr()) {
    throw new Error(
      substituteResult.error === "no_suitable_substitutes"
        ? "No suitable substitute exercises found"
        : substituteResult.error === "equipment_unavailable"
          ? "No substitutes available with selected equipment"
          : "Failed to find substitute exercise",
    );
  }

  return redirect(
    `/workouts/${input.workoutId}?substituted=${input.exerciseId}&new=${substituteResult.value.id}`,
  );
}
