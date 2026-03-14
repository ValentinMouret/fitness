import { today } from "~/time";
import { handleResultError } from "~/utils/errors";
import { HabitCompletion } from "../domain/entity";
import {
  HabitCompletionRepository,
  HabitRepository,
} from "./repository.server";

export async function getHabitsWeekData() {
  const habitsResult = await HabitRepository.fetchActive();
  if (habitsResult.isErr()) {
    handleResultError(habitsResult, "Failed to load habits");
  }

  const habits = habitsResult.value;
  const todayDate = today();

  const dayOfWeek = todayDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(todayDate);
  weekStart.setDate(weekStart.getDate() + mondayOffset);

  // 0=Mon, 6=Sun
  const todayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const completionsResult = await HabitCompletionRepository.fetchByDateRange(
    weekStart,
    todayDate,
  );
  if (completionsResult.isErr()) {
    handleResultError(completionsResult, "Failed to load completions");
  }

  const completionMap: Record<string, boolean[]> = {};
  for (const habit of habits) {
    completionMap[habit.id] = [false, false, false, false, false, false, false];
  }

  for (const completion of completionsResult.value) {
    if (!completionMap[completion.habitId]) continue;
    const d = new Date(completion.completionDate);
    const dow = d.getDay(); // 0=Sun
    const idx = dow === 0 ? 6 : dow - 1; // 0=Mon
    completionMap[completion.habitId][idx] = completion.completed;
  }

  const todayCompletionMap: Record<string, boolean> = {};
  for (const habit of habits) {
    todayCompletionMap[habit.id] =
      completionMap[habit.id]?.[todayIndex] ?? false;
  }

  return { habits, weekStart, todayIndex, completionMap, todayCompletionMap };
}

export async function toggleWeekHabitCompletion(input: {
  readonly habitId: string;
  readonly completed: boolean;
  readonly date?: Date;
  readonly notes?: string;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const completion = HabitCompletion.create(
    input.habitId,
    input.date ?? today(),
    !input.completed,
    input.notes,
  );

  const result = await HabitCompletionRepository.save(completion);

  if (result.isErr()) {
    return { ok: false, error: "Failed to save completion", status: 500 };
  }

  return { ok: true };
}
