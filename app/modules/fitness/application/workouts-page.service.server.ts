import { WorkoutAnalysisService } from "~/modules/fitness/application/workout-analysis.service.server";
import type { AIFitnessCoachResult } from "~/modules/fitness/infra/ai-fitness-coach.service";
import { AIFitnessCoachService } from "~/modules/fitness/infra/ai-fitness-coach.service";
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

export type AIFeedbackResponse = {
  readonly aiFeedback?: AIFitnessCoachResult;
  readonly error?: string;
};

export async function getAiFeedback(): Promise<AIFeedbackResponse> {
  try {
    const analysisDataResult =
      await WorkoutAnalysisService.generateAnalysisData();

    if (analysisDataResult.isErr()) {
      return {
        error:
          analysisDataResult.error === "insufficient_data"
            ? "Not enough workout data for analysis. Complete at least 5 workouts to get AI feedback."
            : "Failed to analyze workout data. Please try again.",
      };
    }

    const aiResult = await AIFitnessCoachService.analyzeWorkouts(
      analysisDataResult.value,
    );

    if (aiResult.isErr()) {
      return {
        error: "Failed to generate AI feedback. Please try again later.",
      };
    }

    return {
      aiFeedback: aiResult.value,
    };
  } catch (error) {
    console.error("AI feedback error:", error);
    return {
      error: "An unexpected error occurred while generating feedback.",
    };
  }
}
