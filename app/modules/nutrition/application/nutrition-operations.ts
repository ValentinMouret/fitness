import { errAsync, ResultAsync } from "neverthrow";
import type { ErrRepository } from "~/repository";
import { fromDateString } from "~/time";
import type { NotEmpty } from "~/utils/types";
import type { CreateIngredientInput, Ingredient } from "../domain/ingredient";
import {
  type MealIngredientInput,
  validateMealComposition,
} from "../domain/meal-composition";
import type {
  CreateMealLogInput,
  MealLog,
  MealLogWithIngredients,
  UpdateMealLogInput,
} from "../domain/meal-log";
import type {
  CreateIngredientCommand,
  LogMealCommand,
  NutritionError,
  UpdateMealLogCommand,
} from "../domain/nutrition-commands";

type RepositoryError = ErrRepository | "conflict";
type Ingredients = {
  readonly fetchById: (id: string) => ResultAsync<Ingredient, ErrRepository>;
  readonly save: (
    input: CreateIngredientInput,
  ) => ResultAsync<Ingredient, RepositoryError>;
};
type Meals = {
  readonly save: (
    input: CreateMealLogInput,
  ) => ResultAsync<MealLogWithIngredients, RepositoryError>;
  readonly update: (
    id: string,
    input: UpdateMealLogInput,
  ) => ResultAsync<MealLog, ErrRepository>;
  readonly delete: (id: string) => ResultAsync<void, ErrRepository>;
};
const toError = (code: RepositoryError): NutritionError => ({
  code: code === "validation_error" ? "invalid_input" : code,
  message:
    code === "conflict"
      ? "A record already exists. Query it before updating."
      : code === "not_found"
        ? "Meal or ingredient not found."
        : code === "validation_error"
          ? "Invalid nutrition data."
          : "Could not save nutrition data.",
});

export function resolveMealIngredients(
  input: Readonly<NotEmpty<MealIngredientInput>>,
  fetch: Ingredients["fetchById"],
) {
  if (input.length === 0 || validateMealComposition(input).isErr())
    return errAsync("validation_error" as const);
  return ResultAsync.combine(
    input.map((item) =>
      fetch(item.id).map((ingredient) => ({
        ingredient,
        quantityGrams: item.quantity,
      })),
    ),
  );
}

export function nutritionOperations(ingredients: Ingredients, meals: Meals) {
  return {
    createIngredient(input: CreateIngredientCommand) {
      if (input.sliderMax <= input.sliderMin)
        return errAsync<{ readonly ingredient: Ingredient }, NutritionError>(
          toError("validation_error"),
        );
      return ingredients
        .save({ ...input, aiGenerated: false, aiGeneratedAt: null })
        .map((ingredient) => ({ ingredient }))
        .mapErr(toError);
    },
    logMeal(input: LogMealCommand) {
      return resolveMealIngredients(input.ingredients, ingredients.fetchById)
        .andThen((resolved) =>
          meals.save({
            loggedDate: fromDateString(input.loggedDate),
            mealCategory: input.mealCategory,
            notes: input.notes,
            ingredients: resolved,
          }),
        )
        .map((meal) => ({ meal }))
        .mapErr(toError);
    },
    updateMealLog(input: UpdateMealLogCommand) {
      return resolveMealIngredients(input.ingredients, ingredients.fetchById)
        .andThen((resolved) =>
          meals.update(input.mealId, {
            ingredients: resolved,
            notes: input.notes,
            isCompleted: input.isCompleted,
          }),
        )
        .map((meal) => ({ meal }))
        .mapErr(toError);
    },
    deleteMealLog(input: { readonly mealId: string }) {
      return meals
        .delete(input.mealId)
        .map(() => ({ mealId: input.mealId }))
        .mapErr(toError);
    },
  };
}
