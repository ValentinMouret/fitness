import { ResultAsync } from "neverthrow";
import { MeasurementService } from "~/modules/core/application/measurement-service";
import { Measure } from "~/modules/core/domain/measure";
import type { Measure as MeasureRecord } from "~/modules/core/domain/measure";
import type { Measurement } from "~/modules/core/domain/measurements";
import { MeasureRepository } from "~/modules/core/infra/measure.repository.server";
import { MeasurementRepository } from "~/modules/core/infra/measurements.repository.server";
import { HabitService } from "~/modules/habits/application/service";
import { HabitCompletion, type Habit } from "~/modules/habits/domain/entity";
import {
  HabitCompletionRepository,
  HabitRepository,
} from "~/modules/habits/infra/repository.server";
import { WorkoutRepository } from "~/modules/fitness/infra/workout.repository.server";
import type { Workout } from "~/modules/fitness/domain/workout";
import { NutritionService } from "~/modules/nutrition/application/service";
import { TargetService } from "~/modules/core/application/measurement-service";
import { baseMeasurements } from "~/modules/core/domain/measurements";
import { isSameDay, today } from "~/time";
import { createServerError } from "~/utils/errors";

export type DashboardData = {
  readonly weight: Measurement;
  readonly lastWeight: MeasureRecord | undefined;
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
  };
};

export async function getDashboardData(): Promise<DashboardData> {
  const now = new Date();
  const todayDate = today();

  const result = await ResultAsync.combine([
    MeasureRepository.fetchByMeasurementName("weight", 1),
    MeasureRepository.fetchByMeasurementName("weight", 200),
    MeasurementRepository.fetchByName("weight"),
    MeasurementService.fetchStreak("weight"),
    HabitRepository.fetchActive(),
    HabitCompletionRepository.fetchByDateRange(todayDate, todayDate),
    WorkoutRepository.findInProgress(),
    NutritionService.getDailySummary(todayDate),
    TargetService.currentTargets(),
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
  ] = result.value;

  const todayHabits = habits.filter((h) => HabitService.isDueOn(h, todayDate));

  const completionMap = new Map(
    completions.map((c) => [c.habitId, c.completed]),
  );

  const habitStreakPromises = todayHabits.map(async (habit) => {
    const habitCompletions =
      await HabitCompletionRepository.fetchByHabitBetween(
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

  let calorieTarget = 2100;
  const dailyCalorieTarget = targetsResult.find(
    (t) => t.measurement === baseMeasurements.dailyCalorieIntake.name,
  );
  if (dailyCalorieTarget) {
    calorieTarget = dailyCalorieTarget.value;
  }

  const dailySummary = dailySummaryResult.dailyTotals;

  return {
    weight,
    streak,
    lastWeight: weights?.[0],
    weightData,
    loggedToday: Boolean(weights?.[0] && isSameDay(weights[0].t, now)),
    todayHabits,
    completionMap,
    habitStreaks,
    completedHabitsCount,
    inProgressWorkout,
    nutrition: {
      calories: dailySummary.calories,
      calorieTarget,
    },
  };
}

export async function toggleHabitCompletion(input: {
  readonly habitId: string;
  readonly completed: boolean;
}): Promise<void> {
  const completion = HabitCompletion.create(
    input.habitId,
    today(),
    !input.completed,
  );

  const result = await HabitCompletionRepository.save(completion);

  if (result.isErr()) {
    throw createServerError("Failed to toggle habit", 500, result.error);
  }
}

export async function logWeight(input: {
  readonly weight: number;
}): Promise<void> {
  const result = await MeasureRepository.save(
    Measure.create("weight", input.weight),
  );

  if (result.isErr()) {
    throw createServerError("Failed to save weight", 500, result.error);
  }
}
