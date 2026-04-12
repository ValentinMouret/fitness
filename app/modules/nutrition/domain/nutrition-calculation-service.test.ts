import { describe, expect, it } from "vitest";
import { NutritionCalculationService } from "./nutrition-calculation-service";

describe("NutritionCalculationService", () => {
  describe("mifflinStJeor", () => {
    it("calculates maintenance calories for male correctly", () => {
      // BMR = 10 * 70 + 6.5 * 180 - 5 * 30 + 5 = 700 + 1170 - 150 + 5 = 1725
      // With activity 1.4: 1725 * 1.4 = 2415
      const result = NutritionCalculationService.mifflinStJeor({
        weight: 70,
        height: 180,
        age: 30,
        activity: 1.4,
        gender: "male",
      });
      expect(result).toBe(2415);
    });

    it("calculates maintenance calories for female correctly", () => {
      // BMR = 10 * 70 + 6.5 * 180 - 5 * 30 - 161 = 700 + 1170 - 150 - 161 = 1559
      // With activity 1.4: 1559 * 1.4 = 2182.6
      const result = NutritionCalculationService.mifflinStJeor({
        weight: 70,
        height: 180,
        age: 30,
        activity: 1.4,
        gender: "female",
      });
      expect(result).toBe(2182.6);
    });
  });
});
