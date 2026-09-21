import { err, ok } from "neverthrow";

export type MealIngredientInput = {
  readonly id: string;
  readonly quantity: number;
};

export function validateMealComposition(
  ingredients: readonly MealIngredientInput[],
) {
  return ingredients.length > 0 &&
    new Set(ingredients.map(({ id }) => id)).size === ingredients.length &&
    ingredients.every(
      ({ quantity }) => Number.isFinite(quantity) && quantity > 0,
    )
    ? ok(ingredients)
    : err("invalid_ingredients" as const);
}
