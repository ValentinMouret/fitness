import type { UserId } from "~/modules/auth/domain/user";
import { baseMeasurements } from "~/modules/core/domain/measurements";
import { createTargetService } from "~/modules/core/infra/measurement-service.server";
import { resolveDailyTargets } from "~/modules/nutrition/domain/daily-targets";
import type { MealCategory } from "~/modules/nutrition/domain/meal-template";
import { createNutritionService } from "~/modules/nutrition/infra/service.server";
import { handleResultError } from "~/utils/errors";

export async function getMealsPageData(userId: UserId, date: Date) {
  const dailySummaryResult =
    await createNutritionService(userId).getDailySummary(date);
  const mealTemplatesResult =
    await createNutritionService(userId).getAllMealTemplates();
  const activeTargets = await createTargetService(userId).currentTargets();

  if (dailySummaryResult.isErr()) {
    handleResultError(dailySummaryResult, "Failed to load daily summary");
  }

  if (mealTemplatesResult.isErr()) {
    handleResultError(mealTemplatesResult, "Failed to load meal templates");
  }

  if (activeTargets.isErr()) {
    handleResultError(activeTargets, "Failed to load daily targets");
  }
  const dailyCalorieTarget = activeTargets.value.find(
    (t) => t.measurement === baseMeasurements.dailyCalorieIntake.name,
  );
  const { targets, source: targetSource } = resolveDailyTargets(
    dailyCalorieTarget?.value,
  );

  return {
    dailySummary: dailySummaryResult.value,
    mealTemplates: mealTemplatesResult.value,
    targets,
    targetSource,
    currentDate: date.toISOString(),
  };
}

export type MealActionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string };

export async function applyMealTemplate(
  userId: UserId,
  input: {
    readonly templateId: string;
    readonly mealCategory: MealCategory;
    readonly loggedDate: Date;
  },
): Promise<MealActionResult> {
  const result = await createNutritionService(userId).createMealLogFromTemplate(
    input.templateId,
    input.mealCategory,
    input.loggedDate,
  );

  if (result.isErr()) {
    return { ok: false, error: "Failed to apply template" };
  }

  return { ok: true };
}

export async function deleteMealLog(
  userId: UserId,
  input: {
    readonly mealId: string;
  },
): Promise<MealActionResult> {
  const result = await createNutritionService(userId).deleteMealLog(
    input.mealId,
  );

  if (result.isErr()) {
    return { ok: false, error: "Failed to delete meal" };
  }

  return { ok: true };
}

export async function setMealTemplatePublic(
  userId: UserId,
  input: {
    readonly templateId: string;
    readonly isPublic: boolean;
  },
): Promise<MealActionResult> {
  const result = await createNutritionService(userId).setMealTemplatePublic(
    input.templateId,
    input.isPublic,
  );

  if (result.isErr()) {
    return { ok: false, error: "Failed to update sharing" };
  }

  return { ok: true };
}

export async function saveMealAsTemplate(
  userId: UserId,
  input: {
    readonly mealId: string;
    readonly name: string;
    readonly categories: readonly MealCategory[];
    readonly notes?: string;
  },
): Promise<MealActionResult> {
  const mealResult = await createNutritionService(
    userId,
  ).getMealLogWithIngredients(input.mealId);

  if (mealResult.isErr()) {
    return { ok: false, error: "Failed to load meal" };
  }

  const meal = mealResult.value;
  const templateResult = await createNutritionService(
    userId,
  ).createMealTemplate({
    name: input.name,
    categories: input.categories,
    notes: input.notes,
    ingredients: meal.ingredients,
  });

  if (templateResult.isErr()) {
    return { ok: false, error: "Failed to save template" };
  }

  return { ok: true };
}
