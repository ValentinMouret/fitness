import type { UserId } from "~/modules/auth/domain/user";
import { db } from "~/db/index";
import { nutritionOperations } from "../application/nutrition-operations";
import { createIngredientRepository } from "./ingredient.repository.server";
import { createMealLogRepository } from "./meal-log.repository.server";

export const createNutritionCommands = (userId: UserId, database = db) =>
  nutritionOperations(
    createIngredientRepository(userId, database),
    createMealLogRepository(userId, database),
  );
