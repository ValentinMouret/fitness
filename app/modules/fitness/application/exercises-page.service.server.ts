import { parseExerciseType } from "~/modules/fitness/domain/workout";
import { ExerciseMuscleGroupsRepository } from "~/modules/fitness/infra/repository.server";

export async function getExercisesPageData(input: {
  readonly typeParam?: string | null;
  readonly query?: string | null;
}) {
  const parsedType = parseExerciseType(input.typeParam ?? "");
  const type = parsedType.isOk() ? parsedType.value : undefined;

  const allExercises = await ExerciseMuscleGroupsRepository.listAll({
    type,
    q: input.query?.toString(),
  });

  if (allExercises.isErr()) {
    throw new Error("Error fetching exercises");
  }

  return { allExercises: allExercises.value };
}

export async function deleteExercise(exerciseId: string) {
  if (!exerciseId) {
    throw new Error("Exercise ID is required");
  }

  const result = await ExerciseMuscleGroupsRepository.deleteById(exerciseId);

  if (result.isErr()) {
    throw new Error("Failed to delete exercise");
  }

  return { success: true };
}
