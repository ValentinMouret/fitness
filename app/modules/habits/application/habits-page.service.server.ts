import { HabitService } from "./service";
import { HabitCompletion } from "../domain/entity";
import {
  HabitCompletionRepository,
  HabitRepository,
} from "../infra/repository.server";
import { handleResultError } from "~/utils/errors";
import { isSameDay, today } from "~/time";

const STREAK_MILESTONES = [7, 30, 90, 365];

export async function getHabitsPageData() {
  const habitsResult = await HabitRepository.fetchActive();
  if (habitsResult.isErr()) {
    handleResultError(habitsResult, "Failed to load habits");
  }

  const habits = habitsResult.value;
  const todayDate = today();

  const earliestDate = habits.reduce(
    (min, h) => (h.startDate < min ? h.startDate : min),
    todayDate,
  );

  const completionsResult = await HabitCompletionRepository.fetchByDateRange(
    earliestDate,
    todayDate,
  );
  if (completionsResult.isErr()) {
    handleResultError(completionsResult, "Failed to load completions");
  }

  const completionsByHabit = Map.groupBy(
    completionsResult.value,
    (c) => c.habitId,
  );

  const habitStreaks: Record<string, number> = {};
  const completionMap: Record<string, boolean> = {};

  for (const habit of habits) {
    const habitCompletions = completionsByHabit.get(habit.id) || [];
    habitStreaks[habit.id] = HabitService.calculateStreak(
      habit,
      habitCompletions,
      todayDate,
    );

    const todayCompletion = habitCompletions.find((c) =>
      isSameDay(c.completionDate, todayDate),
    );
    if (todayCompletion) {
      completionMap[habit.id] = todayCompletion.completed;
    }
  }

  const todayHabits = habits.filter((habit) =>
    HabitService.isDueOn(habit, todayDate),
  );

  const completedTodayCount = todayHabits.filter(
    (habit) => completionMap[habit.id],
  ).length;

  return {
    habits,
    todayHabits,
    completionMap,
    habitStreaks,
    todayHabitsCount: todayHabits.length,
    completedTodayCount,
  };
}

export type ToggleCompletionResult =
  | { readonly ok: true; readonly hitMilestone: number | null }
  | { readonly ok: false; readonly error: string; readonly status: number };

export async function toggleHabitCompletion(input: {
  readonly habitId: string;
  readonly completed: boolean;
  readonly notes?: string;
}): Promise<ToggleCompletionResult> {
  const completion = HabitCompletion.create(
    input.habitId,
    today(),
    !input.completed,
    input.notes,
  );

  const result = await HabitCompletionRepository.save(completion);

  if (result.isErr()) {
    return { ok: false, error: "Failed to save completion", status: 500 };
  }

  let hitMilestone: number | null = null;
  if (!input.completed) {
    const habit = await HabitRepository.fetchById(input.habitId);
    if (habit.isOk() && habit.value) {
      const completions = await HabitCompletionRepository.fetchByHabitBetween(
        input.habitId,
        new Date(habit.value.startDate),
        today(),
      );
      if (completions.isOk()) {
        const newStreak = HabitService.calculateStreak(
          habit.value,
          completions.value,
          today(),
        );
        if (STREAK_MILESTONES.includes(newStreak)) {
          hitMilestone = newStreak;
        }
      }
    }
  }

  return { ok: true, hitMilestone };
}
