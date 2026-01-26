import type { InferSelectModel } from "drizzle-orm";
import { ok, type Result } from "neverthrow";
import type { ingredients, mealLogs, mealTemplates } from "~/db/schema";
import type { ErrValidation } from "~/repository";
import type { Ingredient } from "../domain/ingredient";
import type { MealLog } from "../domain/meal-log";
import type { MealTemplate } from "../domain/meal-template";

export function recordToIngredient(
  record: InferSelectModel<typeof ingredients>,
): Result<Ingredient, ErrValidation> {
  return ok({
    id: record.id,
    name: record.name,
    category: record.category,
    calories: record.calories,
    protein: record.protein,
    carbs: record.carbs,
    fat: record.fat,
    fiber: record.fiber,
    waterPercentage: record.water_percentage,
    energyDensity: record.energy_density,
    texture: record.texture,
    isVegetarian: record.is_vegetarian,
    isVegan: record.is_vegan,
    sliderMin: record.slider_min,
    sliderMax: record.slider_max,
    aiGenerated: record.ai_generated,
    aiGeneratedAt: record.ai_generated_at,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    deletedAt: record.deleted_at,
  });
}

export function recordToMealTemplate(
  record: InferSelectModel<typeof mealTemplates>,
): Result<MealTemplate, ErrValidation> {
  return ok({
    id: record.id,
    name: record.name,
    category: record.category,
    notes: record.notes,
    totalCalories: record.total_calories,
    totalProtein: record.total_protein,
    totalCarbs: record.total_carbs,
    totalFat: record.total_fat,
    totalFiber: record.total_fiber,
    satietyScore: record.satiety_score,
    usageCount: record.usage_count,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    deletedAt: record.deleted_at,
  });
}

export function recordToMealLog(
  record: InferSelectModel<typeof mealLogs>,
): Result<MealLog, ErrValidation> {
  return ok({
    id: record.id,
    mealCategory: record.meal_category,
    loggedDate: new Date(record.logged_date),
    isCompleted: record.is_completed,
    notes: record.notes,
    mealTemplateId: record.meal_template_id,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    deletedAt: record.deleted_at,
  });
}
