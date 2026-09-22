import { nutritionOperations } from "../application/nutrition-operations";
import { IngredientRepository } from "./ingredient.repository.server";
import { MealLogRepository } from "./meal-log.repository.server";

export const nutritionCommands = nutritionOperations(
  IngredientRepository,
  MealLogRepository,
);
