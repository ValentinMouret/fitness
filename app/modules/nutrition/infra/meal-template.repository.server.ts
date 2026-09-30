import type { UserId } from "~/modules/auth/domain/user";
import { and, eq, isNull, sql } from "drizzle-orm";
import { err, ok, Result, ResultAsync } from "neverthrow";
import { db } from "~/db/index";
import {
  ingredients,
  mealTemplateIngredients,
  mealTemplates,
} from "~/db/schema";
import { logger } from "~/logger.server";
import type { ErrRepository } from "~/repository";
import {
  executeQuery,
  fetchSingleRecord,
  type Transaction,
} from "~/repository.server";
import type { IngredientWithQuantity } from "../domain/ingredient";
import { Ingredient } from "../domain/ingredient";
import {
  type CreateMealTemplateInput,
  calculateSatietyScore,
  type MealTemplate,
  type MealTemplateWithIngredients,
  type UpdateMealTemplateInput,
} from "../domain/meal-template";
import { recordToIngredient, recordToMealTemplate } from "./record-mappers";

export function createMealTemplateRepository(userId: UserId, database = db) {
  return {
    listAll(): ResultAsync<readonly MealTemplate[], ErrRepository> {
      const query = database
        .select()
        .from(mealTemplates)
        .where(
          and(
            eq(mealTemplates.userId, userId),
            isNull(mealTemplates.deleted_at),
          ),
        );

      return executeQuery(query, "listAll").andThen((records) => {
        const results = records.map(recordToMealTemplate);
        return Result.combine(results);
      });
    },

    fetchById(id: string): ResultAsync<MealTemplate, ErrRepository> {
      const query = database
        .select()
        .from(mealTemplates)
        .where(
          and(
            eq(mealTemplates.userId, userId),
            eq(mealTemplates.id, id),
            isNull(mealTemplates.deleted_at),
          ),
        )
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

    setPublic(
      id: string,
      isPublic: boolean,
      tx?: Transaction,
    ): ResultAsync<void, ErrRepository> {
      return ResultAsync.fromPromise(
        (tx ?? database)
          .update(mealTemplates)
          .set({ is_public: isPublic, updated_at: new Date() })
          .where(
            and(
              eq(mealTemplates.userId, userId),
              eq(mealTemplates.id, id),
              isNull(mealTemplates.deleted_at),
            ),
          )
          .returning({ id: mealTemplates.id }),
        (error) => {
          logger.error(
            { err: error },
            "Failed to set meal template visibility",
          );
          return "database_error" as const;
        },
      ).andThen((rows) =>
        rows.length ? ok(undefined) : err("not_found" as const),
      );
    },

    fetchTemplateIngredients(
      templateId: string,
    ): ResultAsync<readonly IngredientWithQuantity[], ErrRepository> {
      const query = database
        .select({
          quantity_grams: mealTemplateIngredients.quantity_grams,
          ingredient: ingredients,
        })
        .from(mealTemplateIngredients)
        .innerJoin(
          ingredients,
          eq(mealTemplateIngredients.ingredient_id, ingredients.id),
        )
        .innerJoin(
          mealTemplates,
          eq(mealTemplates.id, mealTemplateIngredients.meal_template_id),
        )
        .where(
          and(
            eq(mealTemplateIngredients.meal_template_id, templateId),
            eq(mealTemplates.userId, userId),
            isNull(mealTemplates.deleted_at),
            eq(mealTemplateIngredients.userId, userId),
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
      const transaction = tx ?? database;

      return ResultAsync.fromPromise(
        transaction.transaction(async (trx) => {
          const totals = Ingredient.calculateTotalNutrition(input.ingredients);
          const satiety = calculateSatietyScore(input.ingredients, totals);

          // Insert meal template
          const templateValues = {
            userId,
            name: input.name,
            categories: [...input.categories],
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
                userId,
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
      if (updates.categories !== undefined)
        updateValues.categories = [...updates.categories];
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
        (tx ?? database)
          .update(mealTemplates)
          .set(updateValues)
          .where(
            and(
              eq(mealTemplates.userId, userId),
              eq(mealTemplates.id, id),
              isNull(mealTemplates.deleted_at),
            ),
          )
          .returning(),
        (error) => {
          logger.error({ err: error }, "Failed to update meal template");
          return "database_error" as const;
        },
      ).andThen((records) => {
        if (records.length === 0) {
          return err("not_found" as const);
        }
        return recordToMealTemplate(records[0]);
      });
    },

    incrementUsageCount(
      id: string,
      tx?: Transaction,
    ): ResultAsync<void, ErrRepository> {
      return ResultAsync.fromPromise(
        (tx ?? database)
          .update(mealTemplates)
          .set({
            usage_count: sql`${mealTemplates.usage_count} + 1`,
            updated_at: new Date(),
          })
          .where(
            and(
              eq(mealTemplates.userId, userId),
              eq(mealTemplates.id, id),
              isNull(mealTemplates.deleted_at),
            ),
          )
          .returning({ id: mealTemplates.id }),
        (error) => {
          logger.error({ err: error }, "Failed to increment usage count");
          return "database_error" as const;
        },
      ).andThen((rows) =>
        rows.length ? ok(undefined) : err("not_found" as const),
      );
    },

    delete(id: string, tx?: Transaction): ResultAsync<void, ErrRepository> {
      return ResultAsync.fromPromise(
        (tx ?? database).transaction(async (trx) => {
          const [owned] = await trx
            .select({ id: mealTemplates.id })
            .from(mealTemplates)
            .where(
              and(
                eq(mealTemplates.userId, userId),
                eq(mealTemplates.id, id),
                isNull(mealTemplates.deleted_at),
              ),
            )
            .for("update");
          if (!owned) return false;
          await trx
            .update(mealTemplateIngredients)
            .set({ deleted_at: new Date() })
            .where(
              and(
                eq(mealTemplateIngredients.userId, userId),
                eq(mealTemplateIngredients.meal_template_id, id),
              ),
            );

          // Soft delete template
          await trx
            .update(mealTemplates)
            .set({ deleted_at: new Date() })
            .where(
              and(
                eq(mealTemplates.userId, userId),
                eq(mealTemplates.id, id),
                isNull(mealTemplates.deleted_at),
              ),
            );
          return true;
        }),
        (error) => {
          logger.error({ err: error }, "Failed to delete meal template");
          return "database_error" as const;
        },
      ).andThen((found) => (found ? ok(undefined) : err("not_found" as const)));
    },
  };
}

export function fetchPublicMealTemplateWithIngredients(
  id: string,
  database = db,
): ResultAsync<MealTemplateWithIngredients, ErrRepository> {
  const query = database
    .select({
      template: mealTemplates,
      ingredient: ingredients,
      quantityGrams: mealTemplateIngredients.quantity_grams,
    })
    .from(mealTemplates)
    .leftJoin(
      mealTemplateIngredients,
      and(
        eq(mealTemplateIngredients.meal_template_id, mealTemplates.id),
        eq(mealTemplateIngredients.userId, mealTemplates.userId),
        isNull(mealTemplateIngredients.deleted_at),
      ),
    )
    .leftJoin(
      ingredients,
      and(
        eq(ingredients.id, mealTemplateIngredients.ingredient_id),
        eq(ingredients.userId, mealTemplates.userId),
        isNull(ingredients.deleted_at),
      ),
    )
    .where(
      and(
        eq(mealTemplates.id, id),
        eq(mealTemplates.is_public, true),
        isNull(mealTemplates.deleted_at),
      ),
    );
  return executeQuery(query, "fetchPublicMealTemplate").andThen((rows) => {
    if (!rows[0]) return err("not_found" as const);
    return recordToMealTemplate(rows[0].template).andThen((template) =>
      Result.combine(
        rows.flatMap((row) => {
          const quantityGrams = row.quantityGrams;
          return row.ingredient && quantityGrams !== null
            ? [
                recordToIngredient(row.ingredient).map((ingredient) => ({
                  ingredient,
                  quantityGrams,
                })),
              ]
            : [];
        }),
      ).map((ingredients) => ({ ...template, ingredients })),
    );
  });
}
