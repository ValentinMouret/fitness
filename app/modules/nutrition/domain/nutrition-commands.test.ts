import { describe, expect, expectTypeOf, it } from "vitest";
import type { NotEmpty } from "~/utils/types";
import type { MealIngredientInput } from "./meal-composition";
import { mealCompositionSchema } from "./nutrition-commands";

const first = { id: "eec42de9-a92d-4b16-801f-080ff4d88f40", quantity: 12.5 };
const second = { id: "8f4d1ae6-e5ce-48ee-84f2-5c06ef8acb86", quantity: 100 };

describe("meal composition boundary", () => {
  it("preserves non-empty readonly typed ingredient records and gram quantities", () => {
    const one = mealCompositionSchema.parse([first]);
    const multiple = mealCompositionSchema.parse([first, second]);
    expect(one).toEqual([first]);
    expect(multiple).toEqual([first, second]);
    expect(Object.isFrozen(multiple)).toBe(true);
    expectTypeOf(one).toExtend<Readonly<NotEmpty<MealIngredientInput>>>();
  });
  it("rejects empty, duplicate and invalid ingredient inputs", () => {
    for (const input of [
      [],
      [first, first],
      [{ ...first, id: "invalid" }],
      [{ ...first, quantity: 0 }],
      [{ ...first, quantity: -1 }],
      [{ ...first, quantity: Number.NaN }],
      [{ ...first, quantity: Number.POSITIVE_INFINITY }],
    ]) {
      expect(mealCompositionSchema.safeParse(input).success).toBe(false);
    }
  });
});
