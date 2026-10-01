import { and, eq, gte, isNull, lte, notInArray, sql } from "drizzle-orm";
import { err, ok, Result, ResultAsync } from "neverthrow";
import { db } from "~/db/index";
import {
  ingredients,
  mealLogIngredients,
  mealLogs,
  mealTemplates,
} from "~/db/schema";
import { logger } from "~/logger.server";
import type { UserId } from "~/modules/auth/domain/user";
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
import { isUniqueViolation } from "./nutrition-errors.server";
import { recordToIngredient, recordToMealLog } from "./record-mappers";

export function createMealLogRepository(userId: UserId, database = db) {
  const lockLog = async (
    tx: Transaction,
    id: string,
    includeArchived = false,
  ) => {
    const [log] = await tx
      .select({ id: mealLogs.id, deletedAt: mealLogs.deleted_at })
      .from(mealLogs)
      .where(
        and(
          eq(mealLogs.userId, userId),
          eq(mealLogs.id, id),
          includeArchived ? undefined : isNull(mealLogs.deleted_at),
        ),
      )
      .for("update");
    return log;
  };
  return {
    fetchById(id: string): ResultAsync<MealLog, ErrRepository> {
      const query = database
        .select()
        .from(mealLogs)
        .where(
          and(
            eq(mealLogs.userId, userId),
            eq(mealLogs.id, id),
            isNull(mealLogs.deleted_at),
          ),
        )
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
      const query = database
        .select()
        .from(mealLogs)
        .where(
          and(
            eq(mealLogs.meal_category, category),
            eq(mealLogs.logged_date, dateString),
            eq(mealLogs.userId, userId),
            isNull(mealLogs.deleted_at),
          ),
        )
        .limit(1);

      return executeQuery(query, "fetchByDateAndCategory").andThen(
        (records) => {
          if (records.length === 0) {
            return ok(null);
          }
          return recordToMealLog(records[0]);
        },
      );
    },

    fetchDailySummary(date: Date): ResultAsync<MealLogSummary, ErrRepository> {
      return this.fetchLogsByDate(date).andThen((logs) =>
        this.enrichLogsWithNutrition(logs).map((validLogs) =>
          createDailySummary(validLogs, date),
        ),
      );
    },

    fetchLogsByDate(
      date: Date,
    ): ResultAsync<readonly MealLog[], ErrRepository> {
      const dateString = toDateString(date);
      const query = database
        .select()
        .from(mealLogs)
        .where(
          and(
            eq(mealLogs.logged_date, dateString),
            eq(mealLogs.userId, userId),
            isNull(mealLogs.deleted_at),
          ),
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

      const query = database
        .select()
        .from(mealLogs)
        .where(
          and(
            gte(mealLogs.logged_date, startDateString),
            lte(mealLogs.logged_date, endDateString),
            eq(mealLogs.userId, userId),
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
      const query = database
        .select({
          quantity_grams: mealLogIngredients.quantity_grams,
          ingredient: ingredients,
        })
        .from(mealLogIngredients)
        .innerJoin(
          ingredients,
          eq(mealLogIngredients.ingredient_id, ingredients.id),
        )
        .innerJoin(mealLogs, eq(mealLogs.id, mealLogIngredients.meal_log_id))
        .where(
          and(
            eq(mealLogIngredients.meal_log_id, logId),
            eq(mealLogs.userId, userId),
            isNull(mealLogs.deleted_at),
            eq(mealLogIngredients.userId, userId),
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
    ): ResultAsync<MealLogWithIngredients, ErrRepository | "conflict"> {
      const transaction = tx ?? database;

      return ResultAsync.fromPromise(
        transaction.transaction(async (trx) => {
          const dateString = toDateString(input.loggedDate);

          // Insert meal log
          const logValues = {
            userId,
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
                userId,
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
                  eq(mealTemplates.userId, userId),
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
          if (isUniqueViolation(error)) return "conflict" as const;
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
        (tx ?? database).transaction(async (trx) => {
          // Update meal log
          const [updatedLog] = await trx
            .update(mealLogs)
            .set(updateValues)
            .where(
              and(
                eq(mealLogs.userId, userId),
                eq(mealLogs.id, id),
                isNull(mealLogs.deleted_at),
              ),
            )
            .returning();

          if (!updatedLog) {
            return null;
          }

          // Update ingredients if provided
          if (updates.ingredients !== undefined) {
            const retainedIds = updates.ingredients.map(
              ({ ingredient }) => ingredient.id,
            );
            await trx
              .update(mealLogIngredients)
              .set({ deleted_at: new Date(), updated_at: new Date() })
              .where(
                and(
                  eq(mealLogIngredients.meal_log_id, id),
                  eq(mealLogIngredients.userId, userId),
                  isNull(mealLogIngredients.deleted_at),
                  retainedIds.length > 0
                    ? notInArray(mealLogIngredients.ingredient_id, retainedIds)
                    : undefined,
                ),
              );

            // Insert new ingredients
            if (updates.ingredients.length > 0) {
              const ingredientValues = updates.ingredients.map(
                ({ ingredient, quantityGrams }) => ({
                  userId,
                  meal_log_id: id,
                  ingredient_id: ingredient.id,
                  quantity_grams: quantityGrams,
                }),
              );

              await trx
                .insert(mealLogIngredients)
                .values(ingredientValues)
                .onConflictDoUpdate({
                  target: [
                    mealLogIngredients.meal_log_id,
                    mealLogIngredients.ingredient_id,
                  ],
                  set: {
                    quantity_grams: sql`excluded.quantity_grams`,
                    deleted_at: null,
                    updated_at: new Date(),
                  },
                });
            }
          }

          return updatedLog;
        }),
        (error) => {
          logger.error({ err: error }, "Failed to update meal log");
          return "database_error" as const;
        },
      ).andThen((record) =>
        record ? recordToMealLog(record) : err("not_found" as const),
      );
    },

    addIngredient(
      logId: string,
      ingredient: IngredientWithQuantity,
      tx?: Transaction,
    ): ResultAsync<void, ErrRepository> {
      return ResultAsync.fromPromise(
        (tx ?? database).transaction(async (trx) => {
          if (!(await lockLog(trx, logId))) return false;
          await trx
            .insert(mealLogIngredients)
            .values({
              userId,
              meal_log_id: logId,
              ingredient_id: ingredient.ingredient.id,
              quantity_grams: ingredient.quantityGrams,
            })
            .onConflictDoUpdate({
              target: [
                mealLogIngredients.meal_log_id,
                mealLogIngredients.ingredient_id,
              ],
              set: {
                quantity_grams: ingredient.quantityGrams,
                deleted_at: null,
                updated_at: new Date(),
              },
              setWhere: sql`${mealLogIngredients.deleted_at} is not null`,
            });
          return true;
        }),
        (error) => {
          logger.error({ err: error }, "Failed to add ingredient");
          return "database_error" as const;
        },
      ).andThen((found) => (found ? ok(undefined) : err("not_found" as const)));
    },

    updateIngredientQuantity(
      logId: string,
      ingredientId: string,
      quantityGrams: number,
      tx?: Transaction,
    ): ResultAsync<void, ErrRepository> {
      return ResultAsync.fromPromise(
        (tx ?? database).transaction(async (trx) => {
          if (!(await lockLog(trx, logId))) return false;
          const rows = await trx
            .update(mealLogIngredients)
            .set({
              quantity_grams: quantityGrams,
              updated_at: new Date(),
            })
            .where(
              and(
                eq(mealLogIngredients.meal_log_id, logId),
                eq(mealLogIngredients.ingredient_id, ingredientId),
                eq(mealLogIngredients.userId, userId),
                isNull(mealLogIngredients.deleted_at),
              ),
            )
            .returning({ id: mealLogIngredients.ingredient_id });
          return rows.length > 0;
        }),
        (error) => {
          logger.error({ err: error }, "Failed to update ingredient quantity");
          return "database_error" as const;
        },
      ).andThen((found) => (found ? ok(undefined) : err("not_found" as const)));
    },

    removeIngredient(
      logId: string,
      ingredientId: string,
      tx?: Transaction,
    ): ResultAsync<void, ErrRepository> {
      return ResultAsync.fromPromise(
        (tx ?? database).transaction(async (trx) => {
          if (!(await lockLog(trx, logId))) return false;
          const rows = await trx
            .update(mealLogIngredients)
            .set({ deleted_at: new Date() })
            .where(
              and(
                eq(mealLogIngredients.meal_log_id, logId),
                eq(mealLogIngredients.ingredient_id, ingredientId),
                eq(mealLogIngredients.userId, userId),
                isNull(mealLogIngredients.deleted_at),
              ),
            )
            .returning({ id: mealLogIngredients.ingredient_id });
          return rows.length > 0;
        }),
        (error) => {
          logger.error({ err: error }, "Failed to remove ingredient");
          return "database_error" as const;
        },
      ).andThen((found) => (found ? ok(undefined) : err("not_found" as const)));
    },

    delete(id: string, tx?: Transaction): ResultAsync<void, ErrRepository> {
      return ResultAsync.fromPromise(
        (tx ?? database).transaction(async (trx) => {
          const log = await lockLog(trx, id, true);
          if (!log) return false;
          if (log.deletedAt) return true;
          await trx
            .update(mealLogIngredients)
            .set({ deleted_at: new Date() })
            .where(
              and(
                eq(mealLogIngredients.userId, userId),
                eq(mealLogIngredients.meal_log_id, id),
              ),
            );

          // Soft delete log
          await trx
            .update(mealLogs)
            .set({ deleted_at: new Date() })
            .where(
              and(
                eq(mealLogs.userId, userId),
                eq(mealLogs.id, id),
                isNull(mealLogs.deleted_at),
              ),
            );
          return true;
        }),
        (error) => {
          logger.error({ err: error }, "Failed to delete meal log");
          return "database_error" as const;
        },
      ).andThen((found) => (found ? ok(undefined) : err("not_found" as const)));
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
}
