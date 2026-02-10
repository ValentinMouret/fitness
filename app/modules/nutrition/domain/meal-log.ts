import { z } from "zod";
import type { IngredientWithQuantity, NutritionalTotals } from "./ingredient";
import { Ingredient } from "./ingredient";
import { type MealCategory, mealCategories } from "./meal-template";

export type { MealCategory };

export const MealLogSchema = z.object({
  id: z.string().uuid(),
  mealCategory: z.enum(mealCategories),
  loggedDate: z.date(),
  isCompleted: z.boolean(),
  notes: z.string().nullable(),
  mealTemplateId: z.string().uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
  deletedAt: z.date().nullable(),
});

export type MealLog = z.infer<typeof MealLogSchema>;

export interface MealLogWithIngredients extends MealLog {
  readonly ingredients: readonly IngredientWithQuantity[];
}

export interface MealLogWithNutrition extends MealLogWithIngredients {
  readonly totals: NutritionalTotals;
}

export type CreateMealLogInput = {
  readonly mealCategory: MealCategory;
  readonly loggedDate: Date;
  readonly notes?: string;
  readonly mealTemplateId?: string;
  readonly ingredients?: readonly IngredientWithQuantity[];
};

export type UpdateMealLogInput = {
  readonly isCompleted?: boolean;
  readonly notes?: string;
  readonly ingredients?: readonly IngredientWithQuantity[];
};

export type MealLogSummary = {
  readonly loggedDate: Date;
  readonly meals: {
    readonly breakfast: MealLogWithNutrition | null;
    readonly lunch: MealLogWithNutrition | null;
    readonly dinner: MealLogWithNutrition | null;
    readonly snack: MealLogWithNutrition | null;
  };
  readonly dailyTotals: NutritionalTotals;
  readonly completedMealsCount: number;
};

export function createMealLog(
  input: CreateMealLogInput,
): Omit<MealLog, "id" | "createdAt" | "updatedAt" | "deletedAt"> {
  return {
    mealCategory: input.mealCategory,
    loggedDate: input.loggedDate,
    isCompleted: false,
    notes: input.notes ?? null,
    mealTemplateId: input.mealTemplateId ?? null,
  };
}

export function calculateMealLogNutrition(
  ingredients: readonly IngredientWithQuantity[],
): NutritionalTotals {
  return Ingredient.calculateTotalNutrition(ingredients);
}

export function canAddIngredient(
  currentIngredients: readonly IngredientWithQuantity[],
  newIngredient: IngredientWithQuantity,
): boolean {
  return !currentIngredients.some(
    (item) => item.ingredient.id === newIngredient.ingredient.id,
  );
}

export function updateIngredientQuantity(
  ingredients: readonly IngredientWithQuantity[],
  ingredientId: string,
  newQuantity: number,
): readonly IngredientWithQuantity[] {
  if (newQuantity <= 0) {
    return ingredients.filter((item) => item.ingredient.id !== ingredientId);
  }

  return ingredients.map((item) =>
    item.ingredient.id === ingredientId
      ? { ...item, quantityGrams: newQuantity }
      : item,
  );
}

export function removeIngredient(
  ingredients: readonly IngredientWithQuantity[],
  ingredientId: string,
): readonly IngredientWithQuantity[] {
  return ingredients.filter((item) => item.ingredient.id !== ingredientId);
}

export function calculateDailyTotals(
  meals: readonly MealLogWithNutrition[],
): NutritionalTotals {
  const totals = meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.totals.calories,
      protein: acc.protein + meal.totals.protein,
      carbs: acc.carbs + meal.totals.carbs,
      fat: acc.fat + meal.totals.fat,
      fiber: acc.fiber + meal.totals.fiber,
      volume: acc.volume + meal.totals.volume,
    }),
    {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      volume: 0,
    },
  );

  return {
    calories: Math.round(totals.calories * 100) / 100,
    protein: Math.round(totals.protein * 100) / 100,
    carbs: Math.round(totals.carbs * 100) / 100,
    fat: Math.round(totals.fat * 100) / 100,
    fiber: Math.round(totals.fiber * 100) / 100,
    volume: Math.round(totals.volume * 100) / 100,
  };
}

export function createDailySummary(
  logs: readonly MealLogWithNutrition[],
  date: Date,
): MealLogSummary {
  const meals = {
    breakfast: logs.find((log) => log.mealCategory === "breakfast") ?? null,
    lunch: logs.find((log) => log.mealCategory === "lunch") ?? null,
    dinner: logs.find((log) => log.mealCategory === "dinner") ?? null,
    snack: logs.find((log) => log.mealCategory === "snack") ?? null,
  };

  const completedMealsCount = Object.values(meals).filter(
    (meal) => meal?.isCompleted,
  ).length;

  const dailyTotals = calculateDailyTotals(
    Object.values(meals).filter(
      (meal): meal is MealLogWithNutrition => meal !== null,
    ),
  );

  return {
    loggedDate: date,
    meals,
    dailyTotals,
    completedMealsCount,
  };
}

export function isValidMealLogDate(date: Date): boolean {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return date <= today;
}
