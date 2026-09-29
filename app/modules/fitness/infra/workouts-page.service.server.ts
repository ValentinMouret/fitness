import { WorkoutRepository } from "~/modules/fitness/infra/workout.repository.server";
import { handleResultError } from "~/utils/errors";

export async function getWorkoutsPageData(input: {
  readonly page: number;
  readonly limit: number;
}) {
  const validPage = Math.max(1, input.page);
  const validLimit = Math.min(Math.max(1, input.limit), 10);

  const result = await WorkoutRepository.findAllWithSummary(
    validPage,
    validLimit,
  );
  if (result.isErr()) {
    handleResultError(result, "Failed to load workouts");
  }

  const { workouts, totalCount } = result.value;
  const totalPages = Math.ceil(totalCount / validLimit);

  return {
    workouts,
    pagination: {
      currentPage: validPage,
      totalPages,
      totalCount,
      limit: validLimit,
    },
  };
}
