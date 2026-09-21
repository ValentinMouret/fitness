import { describe, expect, expectTypeOf, it } from "vitest";
import type { NotEmpty } from "~/utils/types";
import type { MealIngredientInput } from "../domain/meal-composition";
import { mealBuilderQuerySchema, mealLogFormSchema } from "./meal-builder-form";

const id = "a82e42a6-67ec-4ec4-a763-4e9a1bfc5ff9";
const form = (overrides: Readonly<Record<string, string>> = {}) => {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    mode: "update",
    mealId: id,
    ingredients: JSON.stringify([{ id, quantity: 100 }]),
    ...overrides,
  }))
    data.set(key, value);
  return data;
};

describe("meal log form boundary", () => {
  it("rejects invalid edit IDs and create dates at the URL boundary", () => {
    expect(mealBuilderQuerySchema.safeParse({ mealId: "bad" }).success).toBe(
      false,
    );
    expect(
      mealBuilderQuerySchema.safeParse({ date: "2026-02-30", meal: "lunch" })
        .success,
    ).toBe(false);
    expect(
      mealBuilderQuerySchema.parse({
        mealId: id,
        date: "irrelevant",
        meal: "irrelevant",
      }),
    ).toMatchObject({ mealId: id, date: null, mealCategory: null });
  });
  it("parses explicit updates without create-only fields", () => {
    const parsed = mealLogFormSchema.parse(form());
    expectTypeOf(parsed.ingredients).toEqualTypeOf<
      Readonly<NotEmpty<MealIngredientInput>>
    >();
    expect(parsed).toMatchObject({
      mode: "update",
      mealId: id,
      ingredients: [{ id, quantity: 100 }],
    });
  });
  it("requires a real ID for updates instead of falling back to creation", () => {
    expect(mealLogFormSchema.safeParse(form({ mealId: "" })).success).toBe(
      false,
    );
    expect(mealLogFormSchema.safeParse(form({ mealId: "bad" })).success).toBe(
      false,
    );
  });
  it.each([
    "broken-json",
    "{}",
    "[]",
    JSON.stringify([{ id, quantity: 0 }]),
    JSON.stringify([{ id, quantity: -1 }]),
    JSON.stringify([{ id, quantity: "100" }]),
    JSON.stringify([{ id: "bad", quantity: 100 }]),
    JSON.stringify([
      { id, quantity: 100 },
      { id, quantity: 200 },
    ]),
  ])("rejects malformed or invalid composition %s", (ingredients) => {
    expect(mealLogFormSchema.safeParse(form({ ingredients })).success).toBe(
      false,
    );
  });
  it("validates calendar dates for creation", () => {
    expect(
      mealLogFormSchema.safeParse(
        form({
          mode: "create",
          mealCategory: "lunch",
          loggedDate: "2026-02-30",
        }),
      ).success,
    ).toBe(false);
    expect(
      mealLogFormSchema.safeParse(
        form({
          mode: "create",
          mealCategory: "lunch",
          loggedDate: "2026-02-28",
        }),
      ).success,
    ).toBe(true);
  });
});
