import type { Habit } from "./entity";

type ScheduledHabit = Pick<Habit, "id" | "name" | "timeOfDay">;

export function groupDailyHabits<T extends ScheduledHabit>(
  habits: readonly T[],
): {
  readonly morning: readonly T[];
  readonly laterToday: readonly T[];
  readonly anytime: readonly T[];
} {
  const morning: T[] = [];
  const laterToday: T[] = [];
  const anytime: T[] = [];

  for (const habit of habits) {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(habit.timeOfDay)) {
      anytime.push(habit);
    } else if (habit.timeOfDay < "12:00") {
      morning.push(habit);
    } else {
      laterToday.push(habit);
    }
  }

  const byNameAndId = (a: T, b: T) =>
    a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id, "en");
  const byTime = (a: T, b: T) =>
    a.timeOfDay.localeCompare(b.timeOfDay) || byNameAndId(a, b);

  return {
    morning: morning.sort(byTime),
    laterToday: laterToday.sort(byTime),
    anytime: anytime.sort(byNameAndId),
  };
}
