import { expect, it } from "vitest";
import {
  dailyTargetsFromCalories,
  defaultDailyTargets,
  resolveDailyTargets,
} from "./daily-targets";

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

it("distinguishes unsaved defaults from account targets without treating zero as missing", () => {
  expect(resolveDailyTargets(undefined)).toEqual({
    targets: defaultDailyTargets,
    source: "default",
  });
  expect(resolveDailyTargets(2000)).toEqual({
    targets: dailyTargetsFromCalories(2000),
    source: "saved",
  });
  expect(resolveDailyTargets(0)).toEqual({
    targets: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    source: "saved",
  });
});
