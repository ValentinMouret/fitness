import { z } from "zod";
import type { IngredientWithQuantity, NutritionalTotals } from "./ingredient";
import { Ingredient } from "./ingredient";

export const mealCategories = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
] as const;

export type MealCategory = (typeof mealCategories)[number];

export const MealTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  category: z.enum(mealCategories),
  notes: z.string().nullable(),
  totalCalories: z.number().nonnegative(),
  totalProtein: z.number().nonnegative(),
  totalCarbs: z.number().nonnegative(),
  totalFat: z.number().nonnegative(),
  totalFiber: z.number().nonnegative(),
  satietyScore: z.number().nonnegative(),
  usageCount: z.number().int().nonnegative(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
  deletedAt: z.date().nullable(),
});

export type MealTemplate = z.infer<typeof MealTemplateSchema>;

export interface MealTemplateWithIngredients extends MealTemplate {
  readonly ingredients: readonly IngredientWithQuantity[];
}

export type CreateMealTemplateInput = {
  readonly name: string;
  readonly category: MealCategory;
  readonly notes?: string;
  readonly ingredients: readonly IngredientWithQuantity[];
};

export type UpdateMealTemplateInput = Partial<CreateMealTemplateInput>;

export interface SatietyCalculationResult {
  readonly score: number;
  readonly level: 1 | 2 | 3 | 4 | 5;
  readonly description: string;
  readonly estimatedSatisfactionHours: { min: number; max: number };
}

const TEXTURE_MODIFIERS: Record<
  import("./ingredient").TextureCategory,
  number
> = {
  liquid: 1.0,
  semi_liquid: 1.15,
  soft_solid: 1.25,
  firm_solid: 1.35,
};

export function calculateSatietyScore(
  ingredients: readonly IngredientWithQuantity[],
  totals: NutritionalTotals,
): SatietyCalculationResult {
  let weightedTextureModifier = 0;
  let totalWeight = 0;

  for (const { ingredient, quantityGrams } of ingredients) {
    weightedTextureModifier +=
      TEXTURE_MODIFIERS[ingredient.texture] * quantityGrams;
    totalWeight += quantityGrams;
  }

  const averageTextureModifier =
    totalWeight > 0 ? weightedTextureModifier / totalWeight : 1.0;

  const volumeFactor =
    totals.volume > 0 && totals.calories > 0
      ? (totals.volume / totals.calories) * 10
      : 0;

  const baseScore =
    totals.protein * 0.4 + totals.fiber * 0.3 + volumeFactor * 0.2;
  const finalScore = baseScore * averageTextureModifier;

  const normalizedScore = Math.min(Math.max(finalScore / 100, 0), 1);

  let level: 1 | 2 | 3 | 4 | 5;
  let description: string;
  let estimatedSatisfactionHours: { min: number; max: number };

  if (normalizedScore < 0.2) {
    level = 1;
    description = "Light snack";
    estimatedSatisfactionHours = { min: 0.5, max: 1.5 };
  } else if (normalizedScore < 0.4) {
    level = 2;
    description = "Small meal";
    estimatedSatisfactionHours = { min: 1, max: 2.5 };
  } else if (normalizedScore < 0.6) {
    level = 3;
    description = "Moderate meal";
    estimatedSatisfactionHours = { min: 2, max: 4 };
  } else if (normalizedScore < 0.8) {
    level = 4;
    description = "Filling meal";
    estimatedSatisfactionHours = { min: 3, max: 5 };
  } else {
    level = 5;
    description = "Very filling meal";
    estimatedSatisfactionHours = { min: 4, max: 6 };
  }

  return {
    score: finalScore,
    level,
    description,
    estimatedSatisfactionHours,
  };
}

export function createMealTemplateFromIngredients(
  input: CreateMealTemplateInput,
): Omit<MealTemplate, "id" | "createdAt" | "updatedAt" | "deletedAt"> {
  const totals = Ingredient.calculateTotalNutrition(input.ingredients);
  const satiety = calculateSatietyScore(input.ingredients, totals);

  return {
    name: input.name,
    category: input.category,
    notes: input.notes ?? null,
    totalCalories: totals.calories,
    totalProtein: totals.protein,
    totalCarbs: totals.carbs,
    totalFat: totals.fat,
    totalFiber: totals.fiber,
    satietyScore: satiety.score,
    usageCount: 0,
  };
}
