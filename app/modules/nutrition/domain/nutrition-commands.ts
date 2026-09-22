import { z } from "zod";
import { IngredientSchema } from "./ingredient";
import { validateMealComposition } from "./meal-composition";
import { mealCategories } from "./meal-template";

export type NutritionError = {
  readonly code: "invalid_input" | "not_found" | "conflict" | "database_error";
  readonly message: string;
};

const ingredient = z
  .object({ id: z.uuid(), quantity: z.number().positive() })
  .strict();
export const mealCompositionSchema = z
  .tuple([ingredient])
  .rest(ingredient)
  .readonly()
  .refine(
    (items) => validateMealComposition(items).isOk(),
    "Ingredients must be unique with positive gram quantities.",
  );
export const createIngredientSchema = IngredientSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  aiGenerated: true,
  aiGeneratedAt: true,
})
  .extend({
    name: z.string().trim().min(1),
    sliderMin: z.number().int().positive().max(2147483647).default(5),
    sliderMax: z.number().int().positive().max(2147483647).default(500),
  })
  .strict()
  .refine(
    (input) => input.sliderMax > input.sliderMin,
    "sliderMax must exceed sliderMin.",
  );
export const mealLogIdSchema = z.object({ mealId: z.uuid() }).strict();
export const logMealSchema = z
  .object({
    loggedDate: z.iso.date(),
    mealCategory: z.enum(mealCategories),
    ingredients: mealCompositionSchema,
    notes: z.string().max(5000).optional(),
  })
  .strict();
export const updateMealLogSchema = mealLogIdSchema.extend({
  ingredients: mealCompositionSchema,
  notes: z.string().max(5000).optional(),
  isCompleted: z.boolean().optional(),
});
export type CreateIngredientCommand = Readonly<
  z.output<typeof createIngredientSchema>
>;
export type LogMealCommand = Readonly<z.output<typeof logMealSchema>>;
export type UpdateMealLogCommand = Readonly<
  z.output<typeof updateMealLogSchema>
>;
