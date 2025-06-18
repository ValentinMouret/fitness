/**
 * Habit business logic and application services.
 */

import { Day, today } from "../../../time";
import type { Habit, HabitCompletion } from "../domain/entity";

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
    // Create a new date from the endDate's date string to ensure we start from the correct day
    const endDateStr = endDate.toISOString().split("T")[0];
    let currentDate = new Date(endDateStr + "T00:00:00.000Z");

    // Create a map of completion dates for faster lookup
    const completionMap = new Map<string, boolean>();
    for (const completion of completions) {
      const dateStr = completion.completionDate.toISOString().split("T")[0];
      completionMap.set(dateStr, completion.completed);
    }

    // Work backwards from endDate
    const habitStartDateStr = habit.startDate.toISOString().split("T")[0];
    const habitStartDate = new Date(habitStartDateStr + "T00:00:00.000Z");
    
    while (currentDate >= habitStartDate) {
      const dateStr = currentDate.toISOString().split("T")[0];
      
      if (this.isDueOn(habit, currentDate)) {
        const completed = completionMap.get(dateStr) ?? false;

        if (completed) {
          streak++;
        } else {
          // Only break if we've started counting and found an incomplete day
          // If we haven't started counting yet, keep looking backwards
          if (streak > 0) {
            break;
          }
        }
      }

      // Move to previous day in UTC
      currentDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
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