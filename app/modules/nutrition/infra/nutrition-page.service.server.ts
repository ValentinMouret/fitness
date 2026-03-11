import { ResultAsync } from "neverthrow";
import { baseMeasurements } from "~/modules/core/domain/measurements";
import { TargetService } from "~/modules/core/infra/measurement-service";
import { NutritionService } from "~/modules/nutrition/infra/service";
import { today } from "~/time";
import { createServerError } from "~/utils/errors";

export async function getNutritionPageData(date: Date = today()) {
  const result = await ResultAsync.combine([
    TargetService.currentTargets(),
    NutritionService.getDailySummary(date),
  ]);

  if (result.isErr()) {
    throw createServerError("Failed to load nutrition data", 500, result.error);
  }

  const [activeTargets, dailySummary] = result.value;

  const dailyCalorieIntake = activeTargets.find(
    (t) => t.measurement === baseMeasurements.dailyCalorieIntake.name,
  );

  return {
    calorieTarget: dailyCalorieIntake?.value ?? 2100,
    dailySummary,
  };
}
