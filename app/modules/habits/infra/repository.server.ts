/**
 * Habit repository infrastructure - database operations.
 */

import {
  and,
  between,
  desc,
  eq,
  type InferSelectModel,
  lte,
} from "drizzle-orm";
import { err, ok, Result, ResultAsync } from "neverthrow";
import { db } from "../../../db";
import { habit_completions, habits } from "../../../db/schema";
import { logger } from "../../../logger.server";
import type { ErrRepository, ErrValidation } from "../../../repository";
import { executeQuery, fetchSingleRecord } from "../../../repository.server";
import { today } from "../../../time";
import type { Habit, HabitCompletion } from "../domain/entity";

function recordToHabit(
  record: InferSelectModel<typeof habits>,
): Result<Habit, ErrValidation> {
  return ok({
    id: record.id,
    name: record.name,
    description: record.description ?? undefined,
    frequencyType: record.frequency_type as Habit["frequencyType"],
    frequencyConfig: record.frequency_config as Habit["frequencyConfig"],
    targetCount: record.target_count,
    startDate: new Date(record.start_date),
    endDate: record.end_date ? new Date(record.end_date) : undefined,
    isActive: record.is_active,
  });
}

export const HabitRepository = {
  save(habit: Omit<Habit, "id"> | Habit) {
    const values = {
      name: habit.name,
      description: habit.description,
      frequency_type: habit.frequencyType,
      frequency_config: habit.frequencyConfig,
      target_count: habit.targetCount,
      start_date: habit.startDate.toISOString().split("T")[0],
      end_date: habit.endDate?.toISOString().split("T")[0],
      is_active: habit.isActive,
    };

    if ("id" in habit) {
      return ResultAsync.fromPromise(
        db
          .update(habits)
          .set({ ...values, updated_at: new Date() })
          .where(eq(habits.id, habit.id)),
        (error) => {
          logger.error({ err: error }, "Failed to update habit");
          return "database_error" as const;
        },
      );
    }

    return ResultAsync.fromPromise(
      db.insert(habits).values(values).returning(),
      (error) => {
        logger.error({ err: error }, "Failed to insert habit");
        return "database_error" as const;
      },
    ).andThen((records) =>
      records.length > 0
        ? recordToHabit(records[0])
        : err("database_error" as const),
    );
  },

  fetchById(id: string): ResultAsync<Habit, ErrRepository> {
    const query = db.select().from(habits).where(eq(habits.id, id)).limit(1);

    return executeQuery(query, "fetchById")
      .andThen(fetchSingleRecord)
      .andThen((record) => recordToHabit(record));
  },

  fetchActive(): ResultAsync<Habit[], ErrRepository> {
    const query = db
      .select()
      .from(habits)
      .where(
        and(
          eq(habits.is_active, true),
          lte(habits.start_date, today().toISOString().split("T")[0]),
        ),
      )
      .orderBy(habits.name);

    return executeQuery(query, "fetchActive").andThen((records) =>
      Result.combine(records.map(recordToHabit)),
    );
  },

  fetchAll(): ResultAsync<Habit[], ErrRepository> {
    const query = db.select().from(habits).orderBy(desc(habits.created_at));

    return executeQuery(query, "fetchAll").andThen((records) =>
      Result.combine(records.map(recordToHabit)),
    );
  },
};

function recordToHabitCompletion(
  record: InferSelectModel<typeof habit_completions>,
): Result<HabitCompletion, ErrValidation> {
  return ok({
    habitId: record.habit_id,
    completionDate: new Date(record.completion_date),
    completed: record.completed,
    notes: record.notes ?? undefined,
  });
}

export const HabitCompletionRepository = {
  save(completion: HabitCompletion) {
    const dateStr = completion.completionDate.toISOString().split("T")[0];

    return ResultAsync.fromPromise(
      db
        .insert(habit_completions)
        .values({
          habit_id: completion.habitId,
          completion_date: dateStr,
          completed: completion.completed,
          notes: completion.notes,
        })
        .onConflictDoUpdate({
          target: [
            habit_completions.habit_id,
            habit_completions.completion_date,
          ],
          set: {
            completed: completion.completed,
            notes: completion.notes,
            updated_at: new Date(),
          },
        }),
      (error) => {
        logger.error({ err: error }, "Failed to save habit completion");
        return "database_error" as const;
      },
    );
  },

  fetchByHabitAndDate(
    habitId: string,
    date: Date,
  ): ResultAsync<HabitCompletion | null, ErrRepository> {
    const dateStr = date.toISOString().split("T")[0];
    const query = db
      .select()
      .from(habit_completions)
      .where(
        and(
          eq(habit_completions.habit_id, habitId),
          eq(habit_completions.completion_date, dateStr),
        ),
      )
      .limit(1);

    return executeQuery(query, "fetchByHabitAndDate").andThen((records) =>
      records.length > 0
        ? recordToHabitCompletion(records[0]).map(
            (r) => r as HabitCompletion | null,
          )
        : ok(null),
    );
  },

  fetchByHabitBetween(
    habitId: string,
    from: Date,
    to: Date,
  ): ResultAsync<HabitCompletion[], ErrRepository> {
    const fromStr = from.toISOString().split("T")[0];
    const toStr = to.toISOString().split("T")[0];

    const query = db
      .select()
      .from(habit_completions)
      .where(
        and(
          eq(habit_completions.habit_id, habitId),
          between(habit_completions.completion_date, fromStr, toStr),
        ),
      )
      .orderBy(desc(habit_completions.completion_date));

    return executeQuery(query, "fetchByHabitBetween").andThen((records) =>
      Result.combine(records.map(recordToHabitCompletion)),
    );
  },

  fetchByDateRange(
    from: Date,
    to: Date,
  ): ResultAsync<HabitCompletion[], ErrRepository> {
    const fromStr = from.toISOString().split("T")[0];
    const toStr = to.toISOString().split("T")[0];

    const query = db
      .select()
      .from(habit_completions)
      .where(between(habit_completions.completion_date, fromStr, toStr));

    return executeQuery(query, "fetchByDateRange").andThen((records) =>
      Result.combine(records.map(recordToHabitCompletion)),
    );
  },
};
