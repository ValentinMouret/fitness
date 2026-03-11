import { ResultAsync } from "neverthrow";
import { MeasureRepository } from "~/modules/core/infra/measure.repository.server";
import { HabitService } from "~/modules/habits/application/service";
import {
  HabitCompletionRepository,
  HabitRepository,
} from "~/modules/habits/infra/repository.server";
import { isSameDay, today } from "~/time";

export type QuickActionsData = {
  readonly weightLogged: boolean;
  readonly lastWeight?: number;
  readonly habits: Array<{
    readonly id: string;
    readonly name: string;
    readonly isCompleted: boolean;
    readonly streak: number;
  }>;
};

export async function getQuickActionsData(): Promise<QuickActionsData> {
  const now = new Date();
  const todayDate = today();

  const result = await ResultAsync.combine([
    MeasureRepository.fetchByMeasurementName("weight", 1),
    HabitRepository.fetchActive(),
    HabitCompletionRepository.fetchByDateRange(todayDate, todayDate),
  ]);

  if (result.isErr()) {
    return { weightLogged: false, habits: [], lastWeight: undefined };
  }

  const [weights, habits, completions] = result.value;

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
      const streak = HabitService.calculateStreak(
        habit,
        habitCompletions.value,
        todayDate,
      );
      return [habit.id, streak] as const;
    }
    return [habit.id, 0] as const;
  });

  const streakPairs = await Promise.all(habitStreakPromises);
  const habitStreaks = new Map(streakPairs);

  return {
    weightLogged: Boolean(weights?.[0] && isSameDay(weights[0].t, now)),
    lastWeight: weights?.[0]?.value,
    habits: todayHabits.map((h) => ({
      id: h.id,
      name: h.name,
      isCompleted: completionMap.get(h.id) ?? false,
      streak: habitStreaks.get(h.id) ?? 0,
    })),
  };
}
