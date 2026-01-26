import { ResultAsync } from "neverthrow";
import { db } from "~/db";
import { logger } from "~/logger.server";
import type { ExerciseMuscleGroups } from "~/modules/fitness/domain/workout";
import { ExerciseMuscleGroupsRepository } from "~/modules/fitness/infra/repository.server";
import type { ErrRepository } from "~/repository";

export const ExerciseService = {
  update(
    oldExercise: ExerciseMuscleGroups,
    newExercise: ExerciseMuscleGroups,
  ): ResultAsync<void, ErrRepository> {
    if (oldExercise.exercise.name === newExercise.exercise.name) {
      return ExerciseMuscleGroupsRepository.save(newExercise).map(
        () => undefined,
      );
    }

    return ResultAsync.fromPromise(
      db.transaction(async (_tx) => {
        const deleteResult = await ExerciseMuscleGroupsRepository.deleteById(
          oldExercise.exercise.id,
        );
        if (deleteResult.isErr()) {
          throw new Error("Failed to delete old exercise");
        }

        const saveResult =
          await ExerciseMuscleGroupsRepository.save(newExercise);
        if (saveResult.isErr()) {
          throw new Error("Failed to save new exercise");
        }
      }),
      (err) => {
        logger.error({ err }, "Error updating exercise");
        return "database_error";
      },
    );
  },
};
