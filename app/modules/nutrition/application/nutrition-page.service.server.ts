import { ResultAsync } from "neverthrow";
import { TargetService } from "~/modules/core/application/measurement-service";
import { baseMeasurements } from "~/modules/core/domain/measurements";
import { NutritionService } from "~/modules/nutrition/application/service";
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
