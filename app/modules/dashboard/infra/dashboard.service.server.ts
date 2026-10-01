import { err, ok, ResultAsync } from "neverthrow";
import { db } from "~/db";
import type { UserId } from "~/modules/auth/domain/user";
import {
  getAccountTimeZone,
  requireAccountToday,
} from "~/modules/auth/infra/account-settings.server";
import type { Measure as MeasureRecord } from "~/modules/core/domain/measure";
import { Measure } from "~/modules/core/domain/measure";
import type { Measurement } from "~/modules/core/domain/measurements";
import { baseMeasurements } from "~/modules/core/domain/measurements";
import { createMeasureRepository } from "~/modules/core/infra/measure.repository.server";
import {
  createMeasurementService,
  createTargetService,
} from "~/modules/core/infra/measurement-service.server";
import { createMeasurementRepository } from "~/modules/core/infra/measurements.repository.server";
import type { DailyNote } from "~/modules/daily-note/domain/entity";
import { createDailyNoteRepository } from "~/modules/daily-note/infra/repository.server";
import type { Workout } from "~/modules/fitness/domain/workout";
import { createWorkoutRepository } from "~/modules/fitness/infra/workout.repository.server";
import { HabitService } from "~/modules/habits/application/service";
import { type Habit, HabitCompletion } from "~/modules/habits/domain/entity";
import { createHabitRepositories } from "~/modules/habits/infra/repository.server";
import { resolveDailyTargets } from "~/modules/nutrition/domain/daily-targets";
import { createNutritionService } from "~/modules/nutrition/infra/service.server";
import { dateInTimeZone, isSameDay } from "~/time";
import { createServerError } from "~/utils/errors";

export type DashboardData = {
  readonly weight: Measurement;
  readonly lastWeight: MeasureRecord | undefined;
  readonly weightTarget: number | undefined;
  readonly weightData: MeasureRecord[];
  readonly loggedToday: boolean;
  readonly streak: number;
  readonly todayHabits: Habit[];
  readonly completionMap: Map<string, boolean>;
  readonly habitStreaks: Map<string, number>;
  readonly completedHabitsCount: number;
  readonly inProgressWorkout: Workout | null;
  readonly nutrition: {
    readonly calories: number;
    readonly calorieTarget: number;
    readonly protein: number;
    readonly proteinTarget: number;
    readonly targetSource: "saved" | "default";
  };
  readonly dailyNote: DailyNote | undefined;
};

export async function getDashboardData(userId: UserId): Promise<DashboardData> {
  const repositories = createHabitRepositories(userId);
  const now = new Date();
  const timeZone = (await getAccountTimeZone(userId)) ?? "UTC";
  const todayDate = dateInTimeZone(now, timeZone);

  const result = await ResultAsync.combine([
    createMeasureRepository(userId).fetchByMeasurementName("weight", 1),
    createMeasureRepository(userId).fetchByMeasurementName("weight", 200),
    createMeasurementRepository(userId)
      .fetchByName("weight")
      .orElse((error) =>
        error === "not_found" ? ok(baseMeasurements.weight) : err(error),
      ),
    createMeasurementService(userId).fetchStreak("weight"),
    repositories.habits.fetchActive(todayDate),
    repositories.completions.fetchByDateRange(todayDate, todayDate),
    createWorkoutRepository(userId).findInProgress(),
    createNutritionService(userId).getDailySummary(todayDate),
    createTargetService(userId).currentTargets(),
    createDailyNoteRepository(userId).fetch(),
  ]);

  if (result.isErr()) {
    throw createServerError(
      "Failed to fetch dashboard data",
      500,
      result.error,
    );
  }

  const [
    weights,
    weightData,
    weight,
    streak,
    habits,
    completions,
    inProgressWorkout,
    dailySummaryResult,
    targetsResult,
    dailyNote,
  ] = result.value;

  const todayHabits = habits.filter((h) => HabitService.isDueOn(h, todayDate));

  const completionMap = new Map(
    completions.map((c) => [c.habitId, c.completed]),
  );

  const habitStreakPromises = todayHabits.map(async (habit) => {
    const habitCompletions = await repositories.completions.fetchByHabitBetween(
      habit.id,
      new Date(habit.startDate),
      todayDate,
    );

    if (habitCompletions.isOk()) {
      const habitStreak = HabitService.calculateStreak(
        habit,
        habitCompletions.value,
        todayDate,
      );
      return [habit.id, habitStreak] as const;
    }
    return [habit.id, 0] as const;
  });

  const streakPairs = await Promise.all(habitStreakPromises);
  const habitStreaks = new Map(streakPairs);

  const completedHabitsCount = todayHabits.filter((h) =>
    completionMap.get(h.id),
  ).length;

  const dailyCalorieTarget = targetsResult.find(
    (t) => t.measurement === baseMeasurements.dailyCalorieIntake.name,
  );
  const { targets: nutritionTargets, source: targetSource } =
    resolveDailyTargets(dailyCalorieTarget?.value);

  const dailySummary = dailySummaryResult.dailyTotals;

  return {
    weight,
    streak,
    lastWeight: weights?.[0],
    weightTarget: targetsResult.find(
      (target) => target.measurement === weight.name,
    )?.value,
    weightData,
    loggedToday: Boolean(weights?.[0] && isSameDay(weights[0].t, now)),
    todayHabits,
    completionMap,
    habitStreaks,
    completedHabitsCount,
    inProgressWorkout,
    nutrition: {
      targetSource,
      calories: dailySummary.calories,
      calorieTarget: nutritionTargets.calories,
      protein: dailySummary.protein,
      proteinTarget: nutritionTargets.protein,
    },
    dailyNote,
  };
}

export async function toggleHabitCompletion(
  userId: UserId,
  input: {
    readonly habitId: string;
    readonly completed: boolean;
  },
): Promise<void> {
  const repositories = createHabitRepositories(userId);
  const completion = HabitCompletion.create(
    input.habitId,
    await requireAccountToday(userId),
    !input.completed,
  );

  const result = await repositories.completions.save(completion);

  if (result.isErr()) {
    throw createServerError(
      "Failed to toggle habit",
      result.error === "not_found" ? 404 : 500,
      result.error,
    );
  }
}

export async function logWeight(
  userId: UserId,
  input: {
    readonly weight: number;
  },
): Promise<void> {
  await db.transaction(async (transaction) => {
    const definition = await createMeasurementRepository(userId).ensure(
      baseMeasurements.weight,
      transaction,
    );
    if (definition.isErr())
      throw createServerError("Failed to save weight", 500, definition.error);
    const result = await createMeasureRepository(userId, transaction).save(
      Measure.create("weight", input.weight),
    );
    if (result.isErr()) {
      throw createServerError("Failed to save weight", 500, result.error);
    }
  });
}
