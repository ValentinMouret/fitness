/**
 * Habits and habit completions domain entities.
 * A habit is something you want to do regularly. E.g.: go to the gym.
 * A habit completion tracks whether you completed the habit on a specific date.
 */

import { allDays, type Day } from "../../../time";

export interface FrequencyConfig {
  days_of_week?: Day[];
  interval_days?: number;
  day_of_month?: number;
}

export interface Habit {
  readonly id: string;
  readonly name: string;
  readonly identityPhrase: string;
  readonly timeOfDay: string;
  readonly location: string;
  readonly isKeystone: boolean;
  readonly minimalVersion: string;
  readonly color: string;
  readonly frequencyType: "daily" | "weekly" | "monthly" | "custom";
  readonly frequencyConfig: FrequencyConfig;
  readonly targetCount: number;
  readonly startDate: Date;
  readonly endDate?: Date;
  readonly isActive: boolean;
}

export const Habit = {
  create(
    name: string,
    frequencyType: Habit["frequencyType"],
    frequencyConfig: FrequencyConfig = {},
    options?: {
      identityPhrase?: string;
      timeOfDay?: string;
      location?: string;
      isKeystone?: boolean;
      minimalVersion?: string;
      color?: string;
      targetCount?: number;
      startDate?: Date;
      endDate?: Date;
    },
  ): Omit<Habit, "id"> {
    return {
      name,
      identityPhrase: options?.identityPhrase ?? "",
      timeOfDay: options?.timeOfDay ?? "",
      location: options?.location ?? "",
      isKeystone: options?.isKeystone ?? false,
      minimalVersion: options?.minimalVersion ?? "",
      color: options?.color ?? "#e15a46",
      frequencyType,
      frequencyConfig,
      targetCount: options?.targetCount ?? 1,
      startDate: options?.startDate ?? new Date(),
      endDate: options?.endDate,
      isActive: true,
    };
  },
};

export function getScheduledDays(habit: Habit): Day[] {
  if (habit.frequencyType === "daily") return [...allDays] as Day[];
  return (habit.frequencyConfig.days_of_week as Day[]) ?? [];
}

export interface HabitCompletion {
  readonly habitId: string;
  readonly completionDate: Date;
  readonly completed: boolean;
  readonly notes?: string;
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
