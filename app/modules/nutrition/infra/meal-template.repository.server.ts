import { eq, and, isNull, sql } from "drizzle-orm";
import { Result, ResultAsync } from "neverthrow";
import { db } from "~/db/index";
import {
  mealTemplates,
  mealTemplateIngredients,
  ingredients,
} from "~/db/schema";
import { logger } from "~/logger.server";
import type { ErrRepository } from "~/repository";
import {
  executeQuery,
  fetchSingleRecord,
  type Transaction,
} from "~/repository.server";
import type {
  MealTemplate,
  MealTemplateWithIngredients,
  CreateMealTemplateInput,
  UpdateMealTemplateInput,
} from "../domain/meal-template";
import type { IngredientWithQuantity } from "../domain/ingredient";
import { Ingredient } from "../domain/ingredient";
import { recordToIngredient, recordToMealTemplate } from "./record-mappers";

export const MealTemplateRepository = {
  listAll(): ResultAsync<readonly MealTemplate[], ErrRepository> {
    const query = db
      .select()
      .from(mealTemplates)
      .where(isNull(mealTemplates.deleted_at));

    return executeQuery(query, "listAll").andThen((records) => {
      const results = records.map(recordToMealTemplate);
      return Result.combine(results);
    });
  },

  fetchById(id: string): ResultAsync<MealTemplate, ErrRepository> {
    const query = db
      .select()
      .from(mealTemplates)
      .where(and(eq(mealTemplates.id, id), isNull(mealTemplates.deleted_at)))
      .limit(1);

    return executeQuery(query, "fetchById")
      .andThen(fetchSingleRecord)
      .andThen((record) => recordToMealTemplate(record));
  },

  fetchWithIngredients(
    id: string,
  ): ResultAsync<MealTemplateWithIngredients, ErrRepository> {
    return this.fetchById(id).andThen((template) =>
      this.fetchTemplateIngredients(id).map((ingredientsWithQuantity) => ({
        ...template,
        ingredients: ingredientsWithQuantity,
      })),
    );
  },

  fetchTemplateIngredients(
    templateId: string,
  ): ResultAsync<readonly IngredientWithQuantity[], ErrRepository> {
    const query = db
      .select({
        quantity_grams: mealTemplateIngredients.quantity_grams,
        ingredient: ingredients,
      })
      .from(mealTemplateIngredients)
      .innerJoin(
        ingredients,
        eq(mealTemplateIngredients.ingredient_id, ingredients.id),
      )
      .where(
        and(
          eq(mealTemplateIngredients.meal_template_id, templateId),
          isNull(mealTemplateIngredients.deleted_at),
          isNull(ingredients.deleted_at),
        ),
      );

    return executeQuery(query, "fetchTemplateIngredients").andThen(
      (records) => {
        const results = records.map((record) =>
          recordToIngredient(record.ingredient).map((ingredient) => ({
            ingredient,
            quantityGrams: record.quantity_grams,
          })),
        );
        return Result.combine(results);
      },
    );
  },

  save(
    input: CreateMealTemplateInput,
    tx?: Transaction,
  ): ResultAsync<MealTemplateWithIngredients, ErrRepository> {
    const transaction = tx ?? db;

    return ResultAsync.fromPromise(
      transaction.transaction(async (trx) => {
        // Calculate totals and satiety from ingredients
        const totals = Ingredient.calculateTotalNutrition(input.ingredients);

        // Calculate satiety score
        const { calculateSatietyScore } = await import(
          "../domain/meal-template"
        );
        const satiety = calculateSatietyScore(input.ingredients, totals);

        // Insert meal template
        const templateValues = {
          name: input.name,
          category: input.category,
          notes: input.notes || null,
          total_calories: totals.calories,
          total_protein: totals.protein,
          total_carbs: totals.carbs,
          total_fat: totals.fat,
          total_fiber: totals.fiber,
          satiety_score: satiety.score,
          usage_count: 0,
        };

        const [templateRecord] = await trx
          .insert(mealTemplates)
          .values(templateValues)
          .returning();

        // Insert template ingredients
        if (input.ingredients.length > 0) {
          const ingredientValues = input.ingredients.map(
            ({ ingredient, quantityGrams }) => ({
              meal_template_id: templateRecord.id,
              ingredient_id: ingredient.id,
              quantity_grams: quantityGrams,
            }),
          );

          await trx.insert(mealTemplateIngredients).values(ingredientValues);
        }

        return {
          ...templateRecord,
          ingredients: input.ingredients,
        };
      }),
      (error) => {
        logger.error({ err: error }, "Failed to save meal template");
        return "database_error" as const;
      },
    ).andThen((result) => {
      const templateResult = recordToMealTemplate(result);
      return templateResult.map((template) => ({
        ...template,
        ingredients: result.ingredients,
      }));
    });
  },

  update(
    id: string,
    updates: UpdateMealTemplateInput,
    tx?: Transaction,
  ): ResultAsync<MealTemplate, ErrRepository> {
    const updateValues: Record<string, unknown> = {};

    if (updates.name !== undefined) updateValues.name = updates.name;
    if (updates.category !== undefined)
      updateValues.category = updates.category;
    if (updates.notes !== undefined) updateValues.notes = updates.notes;

    // If ingredients are being updated, recalculate everything
    if (updates.ingredients !== undefined) {
      const totals = updates.ingredients.reduce(
        (acc, { ingredient, quantityGrams }) => {
          const factor = quantityGrams / 100;
          return {
            calories: acc.calories + ingredient.calories * factor,
            protein: acc.protein + ingredient.protein * factor,
            carbs: acc.carbs + ingredient.carbs * factor,
            fat: acc.fat + ingredient.fat * factor,
            fiber: acc.fiber + ingredient.fiber * factor,
            volume:
              acc.volume +
              quantityGrams * (ingredient.waterPercentage / 100 + 0.5),
          };
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, volume: 0 },
      );

      const { calculateSatietyScore } = require("../domain/meal-template");
      const satiety = calculateSatietyScore(updates.ingredients, totals);

      updateValues.total_calories = totals.calories;
      updateValues.total_protein = totals.protein;
      updateValues.total_carbs = totals.carbs;
      updateValues.total_fat = totals.fat;
      updateValues.total_fiber = totals.fiber;
      updateValues.satiety_score = satiety.score;
    }

    updateValues.updated_at = new Date();

    return ResultAsync.fromPromise(
      (tx ?? db)
        .update(mealTemplates)
        .set(updateValues)
        .where(and(eq(mealTemplates.id, id), isNull(mealTemplates.deleted_at)))
        .returning(),
      (error) => {
        logger.error({ err: error }, "Failed to update meal template");
        return "database_error" as const;
      },
    ).andThen((records) => {
      if (records.length === 0) {
        return ResultAsync.fromSafePromise(
          Promise.reject("not_found" as const),
        );
      }
      return recordToMealTemplate(records[0]);
    });
  },

  incrementUsageCount(
    id: string,
    tx?: Transaction,
  ): ResultAsync<void, ErrRepository> {
    return ResultAsync.fromPromise(
      (tx ?? db)
        .update(mealTemplates)
        .set({
          usage_count: sql`${mealTemplates.usage_count} + 1`,
          updated_at: new Date(),
        })
        .where(and(eq(mealTemplates.id, id), isNull(mealTemplates.deleted_at))),
      (error) => {
        logger.error({ err: error }, "Failed to increment usage count");
        return "database_error" as const;
      },
    ).map(() => undefined);
  },

  delete(id: string, tx?: Transaction): ResultAsync<void, ErrRepository> {
    return ResultAsync.fromPromise(
      (tx ?? db).transaction(async (trx) => {
        // Soft delete template ingredients first
        await trx
          .update(mealTemplateIngredients)
          .set({ deleted_at: new Date() })
          .where(eq(mealTemplateIngredients.meal_template_id, id));

        // Soft delete template
        await trx
          .update(mealTemplates)
          .set({ deleted_at: new Date() })
          .where(
            and(eq(mealTemplates.id, id), isNull(mealTemplates.deleted_at)),
          );
      }),
      (error) => {
        logger.error({ err: error }, "Failed to delete meal template");
        return "database_error" as const;
      },
    ).map(() => undefined);
  },
};
