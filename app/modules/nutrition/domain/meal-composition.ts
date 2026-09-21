import { err, ok } from "neverthrow";
import type { NotEmpty } from "~/utils/types";

export type MealIngredientInput = {
  readonly id: string;
  readonly quantity: number;
};

export function validateMealComposition(
  ingredients: Readonly<NotEmpty<MealIngredientInput>>,
) {
  return new Set(ingredients.map(({ id }) => id)).size === ingredients.length &&
    ingredients.every(
      ({ quantity }) => Number.isFinite(quantity) && quantity > 0,
    )
    ? ok(ingredients)
    : err("invalid_ingredients" as const);
}
