import { expect, it } from "vitest";
import { dailyTargetsFromCalories, defaultDailyTargets } from "./daily-targets";

it("preserves the nutrition page's calorie-based macro goals", () => {
  expect(dailyTargetsFromCalories(2000)).toEqual({
    calories: 2000,
    protein: 150,
    carbs: 200,
    fat: 67,
  });
  expect(dailyTargetsFromCalories(2100)).toEqual({
    calories: 2100,
    protein: 158,
    carbs: 210,
    fat: 70,
  });
});

it("preserves the existing defaults when no target is saved", () => {
  expect(defaultDailyTargets).toEqual({
    calories: 2100,
    protein: 140,
    carbs: 220,
    fat: 85,
  });
});
