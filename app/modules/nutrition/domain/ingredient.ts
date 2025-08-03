import { z } from "zod";

export const ingredientCategories = [
  "proteins",
  "grains",
  "vegetables",
  "fruits",
  "dairy",
  "fats_oils",
  "nuts_seeds",
  "legumes",
  "herbs_spices",
  "condiments",
  "beverages",
  "other",
] as const;

export type IngredientCategory = (typeof ingredientCategories)[number];

export const textureCategories = [
  "liquid",
  "semi_liquid",
  "soft_solid",
  "firm_solid",
] as const;

export type TextureCategory = (typeof textureCategories)[number];

export const IngredientSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  category: z.enum(ingredientCategories),
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  fiber: z.number().nonnegative(),
  waterPercentage: z.number().min(0).max(100),
  energyDensity: z.number().nonnegative(),
  texture: z.enum(textureCategories),
  isVegetarian: z.boolean(),
  isVegan: z.boolean(),
  sliderMin: z.number().positive(),
  sliderMax: z.number().positive(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
  deletedAt: z.date().nullable(),
});

export type Ingredient = z.infer<typeof IngredientSchema>;

export type CreateIngredientInput = Omit<
  Ingredient,
  "id" | "createdAt" | "updatedAt" | "deletedAt"
>;

export type UpdateIngredientInput = Partial<CreateIngredientInput>;

export interface IngredientWithQuantity {
  readonly ingredient: Ingredient;
  readonly quantityGrams: number;
}

export interface NutritionalTotals {
  readonly calories: number;
  readonly protein: number;
  readonly carbs: number;
  readonly fat: number;
  readonly fiber: number;
  readonly volume: number;
}

export const Ingredient = {
  calculateNutritionForQuantity(
    ingredient: Ingredient,
    quantityGrams: number,
  ): NutritionalTotals {
    const factor = quantityGrams / 100;
    return {
      calories: ingredient.calories * factor,
      protein: ingredient.protein * factor,
      carbs: ingredient.carbs * factor,
      fat: ingredient.fat * factor,
      fiber: ingredient.fiber * factor,
      volume: quantityGrams * (ingredient.waterPercentage / 100 + 0.5),
    };
  },

  calculateTotalNutrition(
    ingredients: readonly IngredientWithQuantity[],
  ): NutritionalTotals {
    return ingredients.reduce(
      (totals, { ingredient, quantityGrams }) => {
        const nutrition = Ingredient.calculateNutritionForQuantity(
          ingredient,
          quantityGrams,
        );
        return {
          calories: totals.calories + nutrition.calories,
          protein: totals.protein + nutrition.protein,
          carbs: totals.carbs + nutrition.carbs,
          fat: totals.fat + nutrition.fat,
          fiber: totals.fiber + nutrition.fiber,
          volume: totals.volume + nutrition.volume,
        };
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, volume: 0 },
    );
  },
};
