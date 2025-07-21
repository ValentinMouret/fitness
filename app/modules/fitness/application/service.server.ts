import { ResultAsync } from "neverthrow";
import type { ErrRepository } from "~/repository";
import type { ExerciseMuscleGroups } from "~/modules/fitness/domain/workout";
import { ExerciseMuscleGroupsRepository } from "~/modules/fitness/infra/repository.server";
import { db } from "~/db";

export const ExerciseService = {
  update(
    oldExercise: ExerciseMuscleGroups,
    newExercise: ExerciseMuscleGroups,
  ): ResultAsync<void, ErrRepository> {
    if (oldExercise.exercise.name === newExercise.exercise.name) {
      return ExerciseMuscleGroupsRepository.save(newExercise).map(() => {});
    }

    return ResultAsync.fromPromise(
      db.transaction(async (tx) => {
        const deleteResult = await ExerciseMuscleGroupsRepository.delete(
          oldExercise.exercise.name,
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
        console.error(err);
        return "database_error";
      },
    );
  },
};
