import type { ResultAsync } from "neverthrow";
import type { ErrRepository } from "~/repository";
import type {
  CreateIngredientInput,
  Ingredient,
  IngredientWithQuantity,
  UpdateIngredientInput,
} from "../domain/ingredient";
import type {
  CreateMealLogInput,
  MealLog,
  MealLogSummary,
  MealLogWithIngredients,
  MealLogWithNutrition,
  UpdateMealLogInput,
} from "../domain/meal-log";
import type {
  CreateMealTemplateInput,
  MealCategory,
  MealTemplate,
  MealTemplateWithIngredients,
  UpdateMealTemplateInput,
} from "../domain/meal-template";
import {
  type AIIngredientSearchResult,
  AIIngredientService,
} from "../infra/ai-ingredient.service";
import { IngredientRepository } from "../infra/ingredient.repository.server";
import { MealLogRepository } from "../infra/meal-log.repository.server";
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

  // AI operations
  async searchIngredientWithAI(
    query: string,
  ): Promise<AIIngredientSearchResult> {
    const result = await AIIngredientService.searchIngredient(query);
    if (result.isErr()) {
      throw result.error;
    }
    return result.value;
  },

  // Utility operations
  clearIngredientsCache(): void {
    IngredientRepository.clearCache();
  },

  // Meal log operations
  getMealLogById(id: string): ResultAsync<MealLog, ErrRepository> {
    return MealLogRepository.fetchById(id);
  },

  getMealLogWithIngredients(
    id: string,
  ): ResultAsync<MealLogWithIngredients, ErrRepository> {
    return MealLogRepository.fetchWithIngredients(id);
  },

  getMealLogWithNutrition(
    id: string,
  ): ResultAsync<MealLogWithNutrition, ErrRepository> {
    return MealLogRepository.fetchWithNutrition(id);
  },

  getMealLogByDateAndCategory(
    date: Date,
    category: MealCategory,
  ): ResultAsync<MealLog | null, ErrRepository> {
    return MealLogRepository.fetchByDateAndCategory(date, category);
  },

  getDailySummary(date: Date): ResultAsync<MealLogSummary, ErrRepository> {
    return MealLogRepository.fetchDailySummary(date);
  },

  getMealLogsByDate(
    date: Date,
  ): ResultAsync<readonly MealLog[], ErrRepository> {
    return MealLogRepository.fetchLogsByDate(date);
  },

  getMealLogsByDateRange(
    startDate: Date,
    endDate: Date,
  ): ResultAsync<readonly MealLog[], ErrRepository> {
    return MealLogRepository.fetchLogsByDateRange(startDate, endDate);
  },

  createMealLog(
    input: CreateMealLogInput,
  ): ResultAsync<MealLogWithIngredients, ErrRepository> {
    return MealLogRepository.save(input);
  },

  createMealLogFromTemplate(
    templateId: string,
    mealCategory: MealCategory,
    loggedDate: Date,
    notes?: string,
  ): ResultAsync<MealLogWithIngredients, ErrRepository> {
    return MealTemplateRepository.fetchWithIngredients(templateId).andThen(
      (template) => {
        const input: CreateMealLogInput = {
          mealCategory,
          loggedDate,
          notes,
          mealTemplateId: templateId,
          ingredients: template.ingredients,
        };
        return MealLogRepository.save(input);
      },
    );
  },

  updateMealLog(
    id: string,
    updates: UpdateMealLogInput,
  ): ResultAsync<MealLog, ErrRepository> {
    return MealLogRepository.update(id, updates);
  },

  addIngredientToMealLog(
    logId: string,
    ingredient: IngredientWithQuantity,
  ): ResultAsync<void, ErrRepository> {
    return MealLogRepository.addIngredient(logId, ingredient);
  },

  updateMealLogIngredientQuantity(
    logId: string,
    ingredientId: string,
    quantityGrams: number,
  ): ResultAsync<void, ErrRepository> {
    return MealLogRepository.updateIngredientQuantity(
      logId,
      ingredientId,
      quantityGrams,
    );
  },

  removeIngredientFromMealLog(
    logId: string,
    ingredientId: string,
  ): ResultAsync<void, ErrRepository> {
    return MealLogRepository.removeIngredient(logId, ingredientId);
  },

  deleteMealLog(id: string): ResultAsync<void, ErrRepository> {
    return MealLogRepository.delete(id);
  },
};
