import { describe, expect, it } from "vitest";
import { MealTemplateSchema } from "../../domain/meal-template";
import { createTemplateSelectionViewModel } from "./template-selection.view-model";

const template = (id: string, categories: readonly string[]) =>
  MealTemplateSchema.parse({
    id,
    name: id,
    categories,
    notes: null,
    totalCalories: 100,
    totalProtein: 10,
    totalCarbs: 20,
    totalFat: 3,
    totalFiber: 4,
    satietyScore: 5,
    usageCount: 0,
    isPublic: false,
    createdAt: new Date(),
    updatedAt: null,
    deletedAt: null,
  });
describe("template meal availability", () => {
  it("reuses one Lunch and Dinner composition while keeping oatmeal Breakfast-only", () => {
    const rice = template("10000000-0000-4000-8000-000000000001", [
      "lunch",
      "dinner",
    ]);
    const oats = template("10000000-0000-4000-8000-000000000002", [
      "breakfast",
    ]);
    for (const meal of ["lunch", "dinner"] as const)
      expect(
        createTemplateSelectionViewModel(meal, [rice, oats]).templates.map(
          (t) => t.id,
        ),
      ).toEqual([rice.id]);
    expect(
      createTemplateSelectionViewModel("breakfast", [rice, oats]).templates.map(
        (t) => t.id,
      ),
    ).toEqual([oats.id]);
    expect(
      createTemplateSelectionViewModel("snack", [rice, oats]).hasTemplates,
    ).toBe(false);
  });
});
