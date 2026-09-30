import { z } from "zod";
import { zfd } from "zod-form-data";
import { formOptionalText, formText } from "~/utils/form-data";
import { validateMealComposition } from "../domain/meal-composition";
import { mealAssignmentsSchema, mealCategories } from "../domain/meal-template";

const ingredientSchema = z
  .object({
    id: z.uuid(),
    quantity: z.number().positive(),
  })
  .readonly();

const compositionSchema = z
  .tuple([ingredientSchema])
  .rest(ingredientSchema)
  .readonly()
  .refine(
    (items) => validateMealComposition(items).isOk(),
    "Choose at least one ingredient, without duplicates.",
  );

const ingredientsField = formText(
  z
    .string()
    .transform((value, ctx) => {
      try {
        return JSON.parse(value);
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid ingredient data." });
        return z.NEVER;
      }
    })
    .pipe(compositionSchema),
);

export const mealAssignmentsField = formText(
  z
    .string()
    .transform((value, ctx) => {
      try {
        return JSON.parse(value);
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid meal times." });
        return z.NEVER;
      }
    })
    .pipe(mealAssignmentsSchema),
);

export const mealTemplateFormSchema = zfd.formData({
  name: formText(z.string().trim().min(1)),
  categories: mealAssignmentsField,
  notes: formOptionalText(),
  ingredients: ingredientsField,
  returnTo: formOptionalText(),
});

export const mealLogFormSchema = zfd.formData(
  z.discriminatedUnion("mode", [
    z.object({
      mode: z.literal("update"),
      mealId: formText(z.uuid()),
      ingredients: ingredientsField,
      returnTo: formOptionalText(),
    }),
    z.object({
      mode: z.literal("create"),
      mealCategory: formText(z.enum(mealCategories)),
      loggedDate: formText(z.iso.date()),
      ingredients: ingredientsField,
      returnTo: formOptionalText(),
    }),
  ]),
);

const queryFields = {
  search: z.string().optional(),
  category: z.string().optional(),
  returnTo: z.string().optional(),
};
export const mealBuilderQuerySchema = z.union([
  z.object({ ...queryFields, mealId: z.uuid() }).transform((query) => ({
    searchTerm: query.search,
    category: query.category,
    returnTo: query.returnTo ?? null,
    mealId: query.mealId,
    mealCategory: null,
    date: null,
    estimateId: null,
  })),
  z
    .object({
      ...queryFields,
      mealId: z.never().optional(),
      meal: z.enum(mealCategories).optional(),
      date: z.iso.date().optional(),
      estimate: z.uuid().optional(),
    })
    .transform((query) => ({
      searchTerm: query.search,
      category: query.category,
      returnTo: query.returnTo ?? null,
      mealId: null,
      mealCategory: query.meal ?? null,
      date: query.date ?? null,
      estimateId: query.estimate ?? null,
    })),
]);
