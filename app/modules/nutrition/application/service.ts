import type { ResultAsync } from "neverthrow";
import type { ErrRepository } from "~/repository";
import type {
  Ingredient,
  CreateIngredientInput,
  UpdateIngredientInput,
} from "../domain/ingredient";
import type {
  MealTemplate,
  MealTemplateWithIngredients,
  CreateMealTemplateInput,
  UpdateMealTemplateInput,
} from "../domain/meal-template";
import { IngredientRepository } from "../infra/ingredient.repository.server";
import { MealTemplateRepository } from "../infra/meal-template.repository.server";

export const NutritionService = {
  // Ingredient operations
  getAllIngredients(): ResultAsync<readonly Ingredient[], ErrRepository> {
    return IngredientRepository.listAll();
  },

  searchIngredients(
    searchTerm?: string,
    category?: string,
  ): ResultAsync<readonly Ingredient[], ErrRepository> {
    return IngredientRepository.searchAndFilter(searchTerm, category);
  },

  getIngredientById(id: string): ResultAsync<Ingredient, ErrRepository> {
    return IngredientRepository.fetchById(id);
  },

  createIngredient(
    input: CreateIngredientInput,
  ): ResultAsync<Ingredient, ErrRepository> {
    return IngredientRepository.save(input);
  },

  updateIngredient(
    id: string,
    updates: UpdateIngredientInput,
  ): ResultAsync<Ingredient, ErrRepository> {
    return IngredientRepository.update(id, updates);
  },

  deleteIngredient(id: string): ResultAsync<void, ErrRepository> {
    return IngredientRepository.delete(id);
  },

  // Meal template operations
  getAllMealTemplates(): ResultAsync<readonly MealTemplate[], ErrRepository> {
    return MealTemplateRepository.listAll();
  },

  getMealTemplateById(id: string): ResultAsync<MealTemplate, ErrRepository> {
    return MealTemplateRepository.fetchById(id);
  },

  getMealTemplateWithIngredients(
    id: string,
  ): ResultAsync<MealTemplateWithIngredients, ErrRepository> {
    return MealTemplateRepository.fetchWithIngredients(id);
  },

  createMealTemplate(
    input: CreateMealTemplateInput,
  ): ResultAsync<MealTemplateWithIngredients, ErrRepository> {
    return MealTemplateRepository.save(input);
  },

  updateMealTemplate(
    id: string,
    updates: UpdateMealTemplateInput,
  ): ResultAsync<MealTemplate, ErrRepository> {
    return MealTemplateRepository.update(id, updates);
  },

  useMealTemplate(id: string): ResultAsync<void, ErrRepository> {
    return MealTemplateRepository.incrementUsageCount(id);
  },

  deleteMealTemplate(id: string): ResultAsync<void, ErrRepository> {
    return MealTemplateRepository.delete(id);
  },

  // Utility operations
  clearIngredientsCache(): void {
    IngredientRepository.clearCache();
  },
};
