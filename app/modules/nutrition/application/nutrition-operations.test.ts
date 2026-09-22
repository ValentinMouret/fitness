import { errAsync, okAsync } from "neverthrow";
import { describe, expect, it } from "vitest";
import type { Ingredient } from "../domain/ingredient";
import { resolveMealIngredients } from "./nutrition-operations";

describe("resolveMealIngredients", () => {
  it("rejects duplicate and invalid quantities before reading catalogue entries", async () => {
    const fetch = () => {
      throw new Error("Must reject before reading");
    };
    for (const quantity of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        (
          await resolveMealIngredients([{ id: "a", quantity }], fetch)
        )._unsafeUnwrapErr(),
      ).toBe("validation_error");
    }
    expect(
      (
        await resolveMealIngredients(
          [
            { id: "a", quantity: 1 },
            { id: "a", quantity: 2 },
          ],
          fetch,
        )
      )._unsafeUnwrapErr(),
    ).toBe("validation_error");
  });
  it("preserves quantities and propagates missing catalogue entries", async () => {
    const ingredient: Ingredient = {
      id: "a",
      name: "Food",
      category: "other",
      calories: 100,
      protein: 1,
      carbs: 1,
      fat: 1,
      fiber: 1,
      waterPercentage: 50,
      energyDensity: 1,
      texture: "soft_solid",
      isVegetarian: true,
      isVegan: true,
      sliderMin: 5,
      sliderMax: 500,
      aiGenerated: false,
      aiGeneratedAt: null,
      createdAt: new Date(),
      updatedAt: null,
      deletedAt: null,
    };
    expect(
      (
        await resolveMealIngredients([{ id: "a", quantity: 12.5 }], () =>
          okAsync(ingredient),
        )
      )._unsafeUnwrap(),
    ).toEqual([{ ingredient, quantityGrams: 12.5 }]);
    expect(
      (
        await resolveMealIngredients([{ id: "a", quantity: 12.5 }], () =>
          errAsync("not_found" as const),
        )
      )._unsafeUnwrapErr(),
    ).toBe("not_found");
  });
});
