import { expect, it } from "vitest";
import { nutritionTargetPercentage } from "./nutrition-totals.view-model";

it("preserves meaningful percentages and leaves zero/invalid targets without a percentage", () => {
  expect(nutritionTargetPercentage(2500, 2000)).toBe(125);
  expect(nutritionTargetPercentage(0, 2000)).toBe(0);
  for (const target of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(nutritionTargetPercentage(0, target)).toBeNull();
    expect(nutritionTargetPercentage(150, target)).toBeNull();
  }
});
