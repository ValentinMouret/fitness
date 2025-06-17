/**
 * Habits and habit completions.
 * A habit is something you want to do regularly. E.g.: go to the gym.
 * A habit completion tracks whether you completed the habit on a specific date.
 */

import {
  and,
  between,
  desc,
  eq,
  lte,
  type InferSelectModel,
} from "drizzle-orm";
import { Result, ResultAsync, err, ok } from "neverthrow";
import { db } from "./db";
import { habit_completions, habits } from "./db/schema";
import {
  executeQuery,
  fetchSingleRecord,
  type ErrRepository,
  type ErrValidation,
} from "./repository";
import { Day, today } from "./time";

export interface FrequencyConfig {
  days_of_week?: Day[];
  interval_days?: number;
  day_of_month?: number;
}

export interface Habit {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly frequencyType: "daily" | "weekly" | "monthly" | "custom";
  readonly frequencyConfig: FrequencyConfig;
  readonly targetCount: number;
  readonly startDate: Date;
  readonly endDate?: Date;
  readonly isActive: boolean;
}

function recordToHabit(
  record: InferSelectModel<typeof habits>,
): Result<Habit, ErrValidation> {
  return ok({
    id: record.id,
    name: record.name,
    description: record.description ?? undefined,
    frequencyType: record.frequency_type as Habit["frequencyType"],
    frequencyConfig: record.frequency_config as FrequencyConfig,
    targetCount: record.target_count,
    startDate: new Date(record.start_date),
    endDate: record.end_date ? new Date(record.end_date) : undefined,
    isActive: record.is_active,
  });
}

export const Habit = {
  create(
    name: string,
    frequencyType: Habit["frequencyType"],
    frequencyConfig: FrequencyConfig = {},
    options?: {
      description?: string;
      targetCount?: number;
      startDate?: Date;
      endDate?: Date;
    },
  ): Omit<Habit, "id"> {
    return {
      name,
      description: options?.description,
      frequencyType,
      frequencyConfig,
      targetCount: options?.targetCount ?? 1,
      startDate: options?.startDate ?? new Date(),
      endDate: options?.endDate,
      isActive: true,
    };
  },
};

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
        (err) => {
          console.error(err);
          return "database_error" as const;
        },
      );
    }

    return ResultAsync.fromPromise(
      db.insert(habits).values(values).returning(),
      (err) => {
        console.error(err);
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

export interface HabitCompletion {
  readonly habitId: string;
  readonly completionDate: Date;
  readonly completed: boolean;
  readonly notes?: string;
}

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

export const HabitCompletion = {
  create(
    habitId: string,
    completionDate: Date,
    completed: boolean,
    notes?: string,
  ): HabitCompletion {
    return {
      habitId,
      completionDate,
      completed,
      notes,
    };
  },
};

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
      (err) => {
        console.error(err);
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

export const HabitService = {
  /**
   * Checks if a habit should be completed on a given date based on its frequency configuration.
   */
  isDueOn(habit: Habit, date: Date): boolean {
    // Check if date is within habit's active period
    if (date < habit.startDate) return false;
    if (habit.endDate && date > habit.endDate) return false;

    switch (habit.frequencyType) {
      case "daily":
        return true;

      case "weekly":
      case "custom": {
        const dayOfWeek = date.getDay();
        if (habit.frequencyConfig.days_of_week) {
          return habit.frequencyConfig.days_of_week.includes(
            Day.fromNumber(dayOfWeek),
          );
        }
        if (habit.frequencyConfig.interval_days) {
          const daysSinceStart = Math.floor(
            (date.getTime() - habit.startDate.getTime()) /
              (1000 * 60 * 60 * 24),
          );
          return daysSinceStart % habit.frequencyConfig.interval_days === 0;
        }
        return true;
      }

      case "monthly": {
        if (habit.frequencyConfig.day_of_month) {
          return date.getDate() === habit.frequencyConfig.day_of_month;
        }
        // Default to same day of month as start date
        return date.getDate() === habit.startDate.getDate();
      }

      default:
        return false;
    }
  },

  /**
   * Calculates the current streak for a habit.
   */
  calculateStreak(
    habit: Habit,
    completions: HabitCompletion[],
    endDate: Date = today(),
  ): number {
    let streak = 0;
    let currentDate = new Date(endDate);
    currentDate.setHours(0, 0, 0, 0);

    // Create a map of completion dates for faster lookup
    const completionMap = new Map<string, boolean>();
    for (const completion of completions) {
      const dateStr = completion.completionDate.toISOString().split("T")[0];
      completionMap.set(dateStr, completion.completed);
    }

    // Work backwards from endDate
    while (currentDate >= habit.startDate) {
      if (this.isDueOn(habit, currentDate)) {
        const dateStr = currentDate.toISOString().split("T")[0];
        const completed = completionMap.get(dateStr) ?? false;

        if (completed) {
          streak++;
        } else {
          // Streak broken
          break;
        }
      }

      // Move to previous day
      currentDate = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() - 1);
    }

    return streak;
  },

  /**
   * Calculates completion rate for a habit over a given period.
   */
  calculateCompletionRate(
    habit: Habit,
    completions: HabitCompletion[],
    from: Date,
    to: Date,
  ): { completed: number; total: number; rate: number } {
    let totalDue = 0;
    let totalCompleted = 0;

    // Create a map of completion dates
    const completionMap = new Map<string, boolean>();
    for (const completion of completions) {
      const dateStr = completion.completionDate.toISOString().split("T")[0];
      completionMap.set(dateStr, completion.completed);
    }

    // Check each day in the range
    const currentDate = new Date(from);
    currentDate.setHours(0, 0, 0, 0);
    const endDate = new Date(to);
    endDate.setHours(23, 59, 59, 999);

    while (currentDate <= endDate) {
      if (this.isDueOn(habit, currentDate)) {
        totalDue++;
        const dateStr = currentDate.toISOString().split("T")[0];
        if (completionMap.get(dateStr) === true) {
          totalCompleted++;
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
      completed: totalCompleted,
      total: totalDue,
      rate: totalDue > 0 ? totalCompleted / totalDue : 0,
    };
  },
};
