import { TargetService } from "~/modules/core/application/measurement-service";
import { baseMeasurements } from "~/modules/core/domain/measurements";
import { NutritionService } from "~/modules/nutrition/application/service";
import { handleResultError } from "~/utils/errors";
import type { MealCategory } from "~/modules/nutrition/domain/meal-template";

export async function getMealsPageData(date: Date) {
  const dailySummaryResult = await NutritionService.getDailySummary(date);
  const mealTemplatesResult = await NutritionService.getAllMealTemplates();
  const activeTargets = await TargetService.currentTargets();

  if (dailySummaryResult.isErr()) {
    handleResultError(dailySummaryResult, "Failed to load daily summary");
  }

  if (mealTemplatesResult.isErr()) {
    handleResultError(mealTemplatesResult, "Failed to load meal templates");
  }

  let targets = null;
  if (activeTargets.isOk()) {
    const dailyCalorieTarget = activeTargets.value.find(
      (t) => t.measurement === baseMeasurements.dailyCalorieIntake.name,
    );
    if (dailyCalorieTarget) {
      targets = {
        calories: dailyCalorieTarget.value,
        protein: Math.round((dailyCalorieTarget.value * 0.3) / 4),
        carbs: Math.round((dailyCalorieTarget.value * 0.4) / 4),
        fat: Math.round((dailyCalorieTarget.value * 0.3) / 9),
      };
    }
  }

  return {
    dailySummary: dailySummaryResult.value,
    mealTemplates: mealTemplatesResult.value,
    targets,
    currentDate: date.toISOString(),
  };
}

export type MealActionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string };

export async function applyMealTemplate(input: {
  readonly templateId: string;
  readonly mealCategory: MealCategory;
  readonly loggedDate: Date;
}): Promise<MealActionResult> {
  const result = await NutritionService.createMealLogFromTemplate(
    input.templateId,
    input.mealCategory,
    input.loggedDate,
  );

  if (result.isErr()) {
    return { ok: false, error: "Failed to apply template" };
  }

  return { ok: true };
}

export async function deleteMealLog(input: {
  readonly mealId: string;
}): Promise<MealActionResult> {
  const result = await NutritionService.deleteMealLog(input.mealId);

  if (result.isErr()) {
    return { ok: false, error: "Failed to delete meal" };
  }

  return { ok: true };
}

export async function saveMealAsTemplate(input: {
  readonly mealId: string;
  readonly name: string;
  readonly category: MealCategory;
  readonly notes?: string;
}): Promise<MealActionResult> {
  const mealResult = await NutritionService.getMealLogWithIngredients(
    input.mealId,
  );

  if (mealResult.isErr()) {
    return { ok: false, error: "Failed to load meal" };
  }

  const meal = mealResult.value;
  const templateResult = await NutritionService.createMealTemplate({
    name: input.name,
    category: input.category,
    notes: input.notes,
    ingredients: meal.ingredients,
  });

  if (templateResult.isErr()) {
    return { ok: false, error: "Failed to save template" };
  }

  return { ok: true };
}
