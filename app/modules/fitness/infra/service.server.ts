import type { ResultAsync } from "neverthrow";
import type { ExerciseMuscleGroups } from "~/modules/fitness/domain/workout";
import { ExerciseMuscleGroupsRepository } from "~/modules/fitness/infra/repository.server";
import type { ErrRepository } from "~/repository";

export const ExerciseService = {
  update(
    _oldExercise: ExerciseMuscleGroups,
    newExercise: ExerciseMuscleGroups,
  ): ResultAsync<void, ErrRepository> {
    return ExerciseMuscleGroupsRepository.update(newExercise);
  },
};
