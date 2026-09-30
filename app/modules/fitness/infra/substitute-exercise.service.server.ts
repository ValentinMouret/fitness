import { redirect } from "react-router";
import type { UserId } from "~/modules/auth/domain/user";
import {
  AdaptiveWorkoutRepository,
  createEquipmentRepository,
} from "~/modules/fitness/infra/adaptive-workout-repository.server";
import { AdaptiveWorkoutService } from "~/modules/fitness/infra/adaptive-workout-service.server";
import { getWorkoutSessionData } from "./workout-session.service.server";

export async function getSubstituteExerciseData(
  userId: UserId,
  input: {
    readonly workoutId: string;
    readonly exerciseId: string;
  },
) {
  const { workoutSession } = await getWorkoutSessionData(
    userId,
    input.workoutId,
  );
  if (
    !workoutSession.exerciseGroups.some(
      (group) => group.exercise.id === input.exerciseId,
    )
  )
    throw new Response("Exercise not found", { status: 404 });
  const availableEquipmentResult =
    await createEquipmentRepository(userId).getAvailableEquipment();
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

export async function substituteExercise(
  userId: UserId,
  input: {
    readonly workoutId: string;
    readonly exerciseId: string;
    readonly selectedEquipmentIds: string[];
  },
) {
  const { workoutSession } = await getWorkoutSessionData(
    userId,
    input.workoutId,
  );
  if (
    !workoutSession.exerciseGroups.some(
      (group) => group.exercise.id === input.exerciseId,
    )
  )
    throw new Response("Exercise not found", { status: 404 });
  const availableEquipmentResult =
    await createEquipmentRepository(userId).getAvailableEquipment();
  if (availableEquipmentResult.isErr()) {
    throw new Error("Failed to load equipment data");
  }

  const ownedEquipmentIds = new Set(
    availableEquipmentResult.value.map((equipment) => equipment.id),
  );
  if (input.selectedEquipmentIds.some((id) => !ownedEquipmentIds.has(id)))
    throw new Response("Equipment not found", { status: 404 });

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
