import { describe, expect, it } from "vitest";
import { parseQuickEstimate } from "./quick-estimate";

const id = "a82e42a6-67ec-4ec4-a763-4e9a1bfc5ff9";
const context = { estimateId: id, date: "2026-09-21", mealCategory: "lunch" };
const ingredients = [{ ingredientId: id, quantity: 100 }];
const stored = JSON.stringify({ ...context, ingredients });
describe("quick estimate destinations", () => {
  it("accepts an estimate only for its intended create session", () => {
    expect(parseQuickEstimate(stored, context)).toEqual(ingredients);
    expect(
      parseQuickEstimate(stored, { ...context, estimateId: null }),
    ).toBeNull();
    expect(
      parseQuickEstimate(stored, {
        ...context,
        estimateId: "cf2ae65e-801c-4f34-acb4-aedffcd8191a",
      }),
    ).toBeNull();
    expect(
      parseQuickEstimate(stored, { ...context, date: "2026-09-22" }),
    ).toBeNull();
    expect(
      parseQuickEstimate(stored, { ...context, mealCategory: "dinner" }),
    ).toBeNull();
  });
  it.each([
    "bad JSON",
    JSON.stringify({ ingredients }),
    JSON.stringify({
      ...context,
      ingredients: [...ingredients, ...ingredients],
    }),
    JSON.stringify({
      ...context,
      ingredients: [{ ingredientId: id, quantity: 0 }],
    }),
  ])("ignores invalid or unscoped data", (value) => {
    expect(parseQuickEstimate(value, context)).toBeNull();
  });
});
