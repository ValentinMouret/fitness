/**
 * Habits and habit completions domain entities.
 * A habit is something you want to do regularly. E.g.: go to the gym.
 * A habit completion tracks whether you completed the habit on a specific date.
 */

import { Day } from "../../../time";

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