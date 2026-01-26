import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { ok, Result, ResultAsync } from "neverthrow";
import { db } from "~/db/index";
import {
  ingredients,
  mealLogIngredients,
  mealLogs,
  mealTemplates,
} from "~/db/schema";
import { logger } from "~/logger.server";
import type { ErrRepository } from "~/repository";
import {
  executeQuery,
  fetchSingleRecord,
  type Transaction,
} from "~/repository.server";
import { toDateString } from "~/time";
import type { IngredientWithQuantity } from "../domain/ingredient";
import type {
  CreateMealLogInput,
  MealCategory,
  MealLog,
  MealLogSummary,
  MealLogWithIngredients,
  MealLogWithNutrition,
  UpdateMealLogInput,
} from "../domain/meal-log";
import {
  calculateMealLogNutrition,
  createDailySummary,
} from "../domain/meal-log";
import { recordToIngredient, recordToMealLog } from "./record-mappers";

export const MealLogRepository = {
  fetchById(id: string): ResultAsync<MealLog, ErrRepository> {
    const query = db
      .select()
      .from(mealLogs)
      .where(and(eq(mealLogs.id, id), isNull(mealLogs.deleted_at)))
      .limit(1);

    return executeQuery(query, "fetchById")
      .andThen(fetchSingleRecord)
      .andThen((record) => recordToMealLog(record));
  },

  fetchWithIngredients(
    id: string,
  ): ResultAsync<MealLogWithIngredients, ErrRepository> {
    return this.fetchById(id).andThen((log) =>
      this.fetchLogIngredients(id).map((ingredientsWithQuantity) => ({
        ...log,
        ingredients: ingredientsWithQuantity,
      })),
    );
  },

  fetchWithNutrition(
    id: string,
  ): ResultAsync<MealLogWithNutrition, ErrRepository> {
    return this.fetchWithIngredients(id).map((log) => ({
      ...log,
      totals: calculateMealLogNutrition(log.ingredients),
    }));
  },

  fetchByDateAndCategory(
    date: Date,
    category: MealCategory,
  ): ResultAsync<MealLog | null, ErrRepository> {
    const dateString = toDateString(date);
    const query = db
      .select()
      .from(mealLogs)
      .where(
        and(
          eq(mealLogs.meal_category, category),
          eq(mealLogs.logged_date, dateString),
          isNull(mealLogs.deleted_at),
        ),
      )
      .limit(1);

    return executeQuery(query, "fetchByDateAndCategory").andThen((records) => {
      if (records.length === 0) {
        return ok(null);
      }
      return recordToMealLog(records[0]);
    });
  },

  fetchDailySummary(date: Date): ResultAsync<MealLogSummary, ErrRepository> {
    return this.fetchLogsByDate(date).andThen((logs) =>
      this.enrichLogsWithNutrition(logs).map((validLogs) =>
        createDailySummary(validLogs, date),
      ),
    );
  },

  fetchLogsByDate(date: Date): ResultAsync<readonly MealLog[], ErrRepository> {
    const dateString = toDateString(date);
    const query = db
      .select()
      .from(mealLogs)
      .where(
        and(eq(mealLogs.logged_date, dateString), isNull(mealLogs.deleted_at)),
      );

    return executeQuery(query, "fetchLogsByDate").andThen((records) => {
      const results = records.map(recordToMealLog);
      return Result.combine(results);
    });
  },

  fetchLogsByDateRange(
    startDate: Date,
    endDate: Date,
  ): ResultAsync<readonly MealLog[], ErrRepository> {
    const startDateString = toDateString(startDate);
    const endDateString = toDateString(endDate);

    const query = db
      .select()
      .from(mealLogs)
      .where(
        and(
          gte(mealLogs.logged_date, startDateString),
          lte(mealLogs.logged_date, endDateString),
          isNull(mealLogs.deleted_at),
        ),
      );

    return executeQuery(query, "fetchLogsByDateRange").andThen((records) => {
      const results = records.map(recordToMealLog);
      return Result.combine(results);
    });
  },

  fetchLogIngredients(
    logId: string,
  ): ResultAsync<readonly IngredientWithQuantity[], ErrRepository> {
    const query = db
      .select({
        quantity_grams: mealLogIngredients.quantity_grams,
        ingredient: ingredients,
      })
      .from(mealLogIngredients)
      .innerJoin(
        ingredients,
        eq(mealLogIngredients.ingredient_id, ingredients.id),
      )
      .where(
        and(
          eq(mealLogIngredients.meal_log_id, logId),
          isNull(mealLogIngredients.deleted_at),
          isNull(ingredients.deleted_at),
        ),
      );

    return executeQuery(query, "fetchLogIngredients").andThen((records) => {
      const results = records.map((record) => {
        return recordToIngredient(record.ingredient).map((ingredient) => ({
          ingredient,
          quantityGrams: record.quantity_grams,
        }));
      });
      return Result.combine(results);
    });
  },

  save(
    input: CreateMealLogInput,
    tx?: Transaction,
  ): ResultAsync<MealLogWithIngredients, ErrRepository> {
    const transaction = tx ?? db;

    return ResultAsync.fromPromise(
      transaction.transaction(async (trx) => {
        const dateString = toDateString(input.loggedDate);

        // Check if a log already exists for this date and meal category
        const existing = await trx
          .select()
          .from(mealLogs)
          .where(
            and(
              eq(mealLogs.meal_category, input.mealCategory),
              eq(mealLogs.logged_date, dateString),
              isNull(mealLogs.deleted_at),
            ),
          )
          .limit(1);

        if (existing.length > 0) {
          throw new Error("Meal log already exists for this date and category");
        }

        // Insert meal log
        const logValues = {
          meal_category: input.mealCategory,
          logged_date: dateString,
          is_completed: false,
          notes: input.notes || null,
          meal_template_id: input.mealTemplateId || null,
        };

        const [logRecord] = await trx
          .insert(mealLogs)
          .values(logValues)
          .returning();

        // Insert log ingredients if provided
        if (input.ingredients && input.ingredients.length > 0) {
          const ingredientValues = input.ingredients.map(
            ({ ingredient, quantityGrams }) => ({
              meal_log_id: logRecord.id,
              ingredient_id: ingredient.id,
              quantity_grams: quantityGrams,
            }),
          );

          await trx.insert(mealLogIngredients).values(ingredientValues);
        }

        // Increment template usage count if using a template
        if (input.mealTemplateId) {
          await trx
            .update(mealTemplates)
            .set({
              usage_count: sql`${mealTemplates.usage_count} + 1`,
              updated_at: new Date(),
            })
            .where(
              and(
                eq(mealTemplates.id, input.mealTemplateId),
                isNull(mealTemplates.deleted_at),
              ),
            );
        }

        return {
          ...logRecord,
          ingredients: input.ingredients || [],
        };
      }),
      (error) => {
        logger.error({ err: error }, "Failed to save meal log");
        return "database_error" as const;
      },
    ).andThen((result) => {
      const logResult = recordToMealLog(result);
      return logResult.map((log) => ({
        ...log,
        ingredients: result.ingredients,
      }));
    });
  },

  update(
    id: string,
    updates: UpdateMealLogInput,
    tx?: Transaction,
  ): ResultAsync<MealLog, ErrRepository> {
    const updateValues: Record<string, unknown> = {};

    if (updates.isCompleted !== undefined) {
      updateValues.is_completed = updates.isCompleted;
    }
    if (updates.notes !== undefined) {
      updateValues.notes = updates.notes;
    }

    updateValues.updated_at = new Date();

    return ResultAsync.fromPromise(
      (tx ?? db).transaction(async (trx) => {
        // Update meal log
        const [updatedLog] = await trx
          .update(mealLogs)
          .set(updateValues)
          .where(and(eq(mealLogs.id, id), isNull(mealLogs.deleted_at)))
          .returning();

        if (!updatedLog) {
          throw new Error("Meal log not found");
        }

        // Update ingredients if provided
        if (updates.ingredients !== undefined) {
          // Delete existing ingredients
          await trx
            .update(mealLogIngredients)
            .set({ deleted_at: new Date() })
            .where(eq(mealLogIngredients.meal_log_id, id));

          // Insert new ingredients
          if (updates.ingredients.length > 0) {
            const ingredientValues = updates.ingredients.map(
              ({ ingredient, quantityGrams }) => ({
                meal_log_id: id,
                ingredient_id: ingredient.id,
                quantity_grams: quantityGrams,
              }),
            );

            await trx.insert(mealLogIngredients).values(ingredientValues);
          }
        }

        return updatedLog;
      }),
      (error) => {
        logger.error({ err: error }, "Failed to update meal log");
        return "database_error" as const;
      },
    ).andThen((record) => recordToMealLog(record));
  },

  addIngredient(
    logId: string,
    ingredient: IngredientWithQuantity,
    tx?: Transaction,
  ): ResultAsync<void, ErrRepository> {
    return ResultAsync.fromPromise(
      (tx ?? db).insert(mealLogIngredients).values({
        meal_log_id: logId,
        ingredient_id: ingredient.ingredient.id,
        quantity_grams: ingredient.quantityGrams,
      }),
      (error) => {
        logger.error({ err: error }, "Failed to add ingredient");
        return "database_error" as const;
      },
    ).map(() => undefined);
  },

  updateIngredientQuantity(
    logId: string,
    ingredientId: string,
    quantityGrams: number,
    tx?: Transaction,
  ): ResultAsync<void, ErrRepository> {
    return ResultAsync.fromPromise(
      (tx ?? db)
        .update(mealLogIngredients)
        .set({
          quantity_grams: quantityGrams,
          updated_at: new Date(),
        })
        .where(
          and(
            eq(mealLogIngredients.meal_log_id, logId),
            eq(mealLogIngredients.ingredient_id, ingredientId),
            isNull(mealLogIngredients.deleted_at),
          ),
        ),
      (error) => {
        logger.error({ err: error }, "Failed to update ingredient quantity");
        return "database_error" as const;
      },
    ).map(() => undefined);
  },

  removeIngredient(
    logId: string,
    ingredientId: string,
    tx?: Transaction,
  ): ResultAsync<void, ErrRepository> {
    return ResultAsync.fromPromise(
      (tx ?? db)
        .update(mealLogIngredients)
        .set({ deleted_at: new Date() })
        .where(
          and(
            eq(mealLogIngredients.meal_log_id, logId),
            eq(mealLogIngredients.ingredient_id, ingredientId),
            isNull(mealLogIngredients.deleted_at),
          ),
        ),
      (error) => {
        logger.error({ err: error }, "Failed to remove ingredient");
        return "database_error" as const;
      },
    ).map(() => undefined);
  },

  delete(id: string, tx?: Transaction): ResultAsync<void, ErrRepository> {
    return ResultAsync.fromPromise(
      (tx ?? db).transaction(async (trx) => {
        // Soft delete log ingredients first
        await trx
          .update(mealLogIngredients)
          .set({ deleted_at: new Date() })
          .where(eq(mealLogIngredients.meal_log_id, id));

        // Soft delete log
        await trx
          .update(mealLogs)
          .set({ deleted_at: new Date() })
          .where(and(eq(mealLogs.id, id), isNull(mealLogs.deleted_at)));
      }),
      (error) => {
        logger.error({ err: error }, "Failed to delete meal log");
        return "database_error" as const;
      },
    ).map(() => undefined);
  },

  enrichLogsWithNutrition(
    logs: readonly MealLog[],
  ): ResultAsync<readonly MealLogWithNutrition[], ErrRepository> {
    const logsWithNutritionPromises = logs.map((log) =>
      this.fetchLogIngredients(log.id)
        .map((ingredients) => ({
          ...log,
          ingredients,
          totals: calculateMealLogNutrition(ingredients),
        }))
        .match(
          (result) => result,
          () => null,
        ),
    );

    return ResultAsync.fromSafePromise(
      Promise.all(logsWithNutritionPromises),
    ).map((results) =>
      results.filter((log): log is MealLogWithNutrition => log !== null),
    );
  },
};
