import { describe, expect, it } from "vitest";
import { createDashboardStatsViewModel } from "./dashboard-stats.view-model";

const input = {
  calories: 1440,
  calorieTarget: 2000,
  protein: 104,
  proteinTarget: 160,
  weight: 78.4,
  weightTarget: 75,
  weightUnit: "kg",
};

describe("dashboard stats", () => {
  it("shows current and goal values with independent intake percentages", () => {
    const [calories, protein, weight] = createDashboardStatsViewModel(input);
    expect(calories).toMatchObject({
      value: "1,440",
      target: "2,000",
      detail: "72% of goal",
      progress: 72,
    });
    expect(protein).toMatchObject({
      value: "104",
      target: "160",
      detail: "65% of goal",
      progress: 65,
    });
    expect(weight).toMatchObject({
      value: "78.4",
      target: "75",
      detail: "3.4 kg to goal",
      progress: null,
    });
  });

  it("keeps over-goal intake visible while capping the progress bar", () => {
    const [calories] = createDashboardStatsViewModel({
      ...input,
      calories: 2500,
    });
    expect(calories).toMatchObject({
      detail: "125% of goal",
      progress: 100,
      accessibleValue: "2,500 of 2,000 kcal",
    });
  });

  it("does not invent goals or divide by zero", () => {
    const [calories, protein, weight] = createDashboardStatsViewModel({
      ...input,
      calorieTarget: 0,
      proteinTarget: -1,
      weightTarget: undefined,
    });
    for (const stat of [calories, protein, weight]) {
      expect(stat).toMatchObject({
        target: null,
        progress: null,
        detail: "No goal set",
      });
    }
  });

  it("retains the weight goal without implying progress when no weight is logged", () => {
    const [, , weight] = createDashboardStatsViewModel({
      ...input,
      weight: undefined,
    });
    expect(weight).toMatchObject({
      value: "—",
      target: "75",
      detail: "No weight logged",
      progress: null,
    });
  });

  it("shows distance for a weight-gain goal and recognises the target", () => {
    expect(
      createDashboardStatsViewModel({ ...input, weight: 70 })[2].detail,
    ).toBe("5 kg to goal");
    expect(
      createDashboardStatsViewModel({ ...input, weight: 75 })[2].detail,
    ).toBe("At goal");
  });
});
