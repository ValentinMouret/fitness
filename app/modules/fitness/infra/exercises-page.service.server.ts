import type { UserId } from "~/modules/auth/domain/user";
import { requireCatalogueOwner } from "./exercise-catalogue-owner.server";
import { parseExerciseType } from "~/modules/fitness/domain/workout";
import { createExerciseMuscleGroupsRepository } from "~/modules/fitness/infra/repository.server";

export async function getExercisesPageData(
  userId: UserId,
  input: {
    readonly typeParam?: string | null;
    readonly query?: string | null;
  },
) {
  const parsedType = parseExerciseType(input.typeParam ?? "");
  const type = parsedType.isOk() ? parsedType.value : undefined;

  const allExercises = await createExerciseMuscleGroupsRepository(
    userId,
  ).listAll({
    type,
    q: input.query?.toString(),
  });

  if (allExercises.isErr()) {
    throw new Error("Error fetching exercises");
  }

  return { allExercises: allExercises.value };
}

export async function deleteExercise(userId: UserId, exerciseId: string) {
  await requireCatalogueOwner(userId);
  if (!exerciseId) {
    throw new Error("Exercise ID is required");
  }

  const result =
    await createExerciseMuscleGroupsRepository(userId).deleteById(exerciseId);

  if (result.isErr()) {
    throw new Error("Failed to delete exercise");
  }

  return { success: true };
}
