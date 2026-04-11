import { z } from "zod";
import { ingredientCategories, textureCategories } from "./ingredient";

export interface EstimationMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export const EstimatedIngredientSchema = z.object({
  name: z.string().min(1),
  estimatedGrams: z.number().positive(),
  category: z.enum(ingredientCategories),
  calories: z.number().min(0).max(900),
  protein: z.number().min(0).max(100),
  carbs: z.number().min(0).max(100),
  fat: z.number().min(0).max(100),
  fiber: z.number().min(0).max(50),
  waterPercentage: z.number().min(0).max(100),
  energyDensity: z.number().min(0).max(9),
  texture: z.enum(textureCategories),
  isVegetarian: z.boolean(),
  isVegan: z.boolean(),
});

export type EstimatedIngredient = z.infer<typeof EstimatedIngredientSchema>;

export const MealEstimationResultSchema = z.object({
  mealCategory: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  items: z.array(EstimatedIngredientSchema).min(1),
});

export type MealEstimationResult = z.infer<typeof MealEstimationResultSchema>;

export interface ResolvedIngredient {
  readonly ingredientId: string;
  readonly quantity: number;
}

export type ChatTurnResult =
  | { readonly type: "message"; readonly content: string }
  | { readonly type: "estimate"; readonly result: MealEstimationResult };
