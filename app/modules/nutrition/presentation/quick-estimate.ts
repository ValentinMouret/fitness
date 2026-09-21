import { z } from "zod";
import { mealCategories } from "../domain/meal-template";

const quickEstimateSchema = z.object({
  estimateId: z.uuid(),
  date: z.iso.date(),
  mealCategory: z.enum(mealCategories),
  ingredients: z
    .array(
      z.object({ ingredientId: z.uuid(), quantity: z.number().positive() }),
    )
    .min(1)
    .refine(
      (items) =>
        new Set(items.map((item) => item.ingredientId)).size === items.length,
    ),
});

export function parseQuickEstimate(
  stored: string,
  destination: {
    readonly estimateId: string | null;
    readonly date: string | null;
    readonly mealCategory: string | null;
  },
) {
  try {
    const parsed = quickEstimateSchema.safeParse(JSON.parse(stored));
    if (!parsed.success) return null;
    const estimate = parsed.data;
    return estimate.estimateId === destination.estimateId &&
      estimate.date === destination.date &&
      estimate.mealCategory === destination.mealCategory
      ? estimate.ingredients
      : null;
  } catch {
    return null;
  }
}
