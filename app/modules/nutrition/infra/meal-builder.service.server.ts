import { data, redirect } from "react-router";
import { logger } from "~/logger.server";
import type { UserId } from "~/modules/auth/domain/user";
import type { MealCategory } from "~/modules/nutrition/domain/meal-template";
import type { CreateIngredientCommand } from "~/modules/nutrition/domain/nutrition-commands";
import { createNutritionService } from "~/modules/nutrition/infra/service.server";
import { fromDateString, toDateString } from "~/time";
import { isSafePath } from "~/utils";
import type { NotEmpty } from "~/utils/types";
import { resolveMealIngredients } from "../application/nutrition-operations";
import {
  type MealIngredientInput,
  validateMealComposition,
} from "../domain/meal-composition";

export async function getMealBuilderData(
  userId: UserId,
  input: {
    readonly searchTerm?: string;
    readonly category?: string;
    readonly mealCategory: MealCategory | null;
    readonly date: string | null;
    readonly returnTo: string | null;
    readonly mealId: string | null;
  },
) {
  const [ingredientsResult, templatesResult] = await Promise.all([
    createNutritionService(userId).searchIngredients(
      input.searchTerm,
      input.category,
    ),
    createNutritionService(userId).getAllMealTemplates(),
  ]);

  if (ingredientsResult.isErr()) {
    throw new Error("Failed to load ingredients");
  }

  if (templatesResult.isErr()) {
    throw new Error("Failed to load meal templates");
  }

  let existingMeal = null;
  if (input.mealId) {
    const mealResult = await createNutritionService(
      userId,
    ).getMealLogWithIngredients(input.mealId);
    if (mealResult.isOk()) {
      existingMeal = mealResult.value;
    } else {
      throw new Response(
        mealResult.error === "not_found"
          ? "Meal not found"
          : "Failed to load meal",
        {
          status: mealResult.error === "not_found" ? 404 : 500,
        },
      );
    }
  }

  return {
    ingredients: ingredientsResult.value,
    mealTemplates: templatesResult.value,
    mealLoggingMode: {
      isEnabled: Boolean(existingMeal || (input.mealCategory && input.date)),
      mealCategory: existingMeal?.mealCategory ?? input.mealCategory,
      date: existingMeal ? toDateString(existingMeal.loggedDate) : input.date,
      returnTo:
        input.returnTo && isSafePath(input.returnTo)
          ? input.returnTo
          : "/nutrition",
      existingMeal,
    },
  };
}

export async function saveMealTemplate(
  userId: UserId,
  input: {
    readonly name: string;
    readonly categories: readonly MealCategory[];
    readonly notes?: string;
    readonly ingredients: Readonly<NotEmpty<MealIngredientInput>>;
    readonly returnTo?: string;
  },
) {
  const ingredients = await resolveMealIngredients(
    input.ingredients,
    createNutritionService(userId).getIngredientById,
  );
  if (ingredients.isErr())
    return data(
      { error: "Could not load an ingredient. Try again." },
      { status: 400 },
    );
  const result = await createNutritionService(userId).createMealTemplate({
    name: input.name,
    categories: input.categories,
    notes: input.notes,
    ingredients: ingredients.value,
  });
  if (result.isErr())
    return data(
      { error: "Could not save the template. Try again." },
      { status: 500 },
    );
  if (
    input.returnTo?.startsWith("/nutrition/templates") &&
    isSafePath(input.returnTo)
  )
    return redirect(input.returnTo);
  return { success: true, template: result.value };
}

export type SaveMealLogInput = {
  readonly ingredients: Readonly<NotEmpty<MealIngredientInput>>;
  readonly returnTo?: string;
} & (
  | { readonly mode: "update"; readonly mealId: string }
  | {
      readonly mode: "create";
      readonly mealCategory: MealCategory;
      readonly loggedDate: string;
    }
);

export async function saveMealLog(userId: UserId, input: SaveMealLogInput) {
  if (validateMealComposition(input.ingredients).isErr()) {
    return data(
      {
        saveError:
          "Choose at least one ingredient with a positive quantity, without duplicates.",
      },
      { status: 400 },
    );
  }
  const ingredientsResult = await resolveMealIngredients(
    input.ingredients,
    createNutritionService(userId).getIngredientById,
  );
  if (ingredientsResult.isErr()) {
    return data(
      {
        saveError:
          "An ingredient could not be loaded. Your changes have not been saved. Please try again.",
      },
      { status: ingredientsResult.error === "not_found" ? 400 : 500 },
    );
  }
  const ingredients = ingredientsResult.value;
  const result =
    input.mode === "update"
      ? await createNutritionService(userId).updateMealLog(input.mealId, {
          ingredients,
        })
      : await createNutritionService(userId).createMealLog({
          mealCategory: input.mealCategory,
          loggedDate: fromDateString(input.loggedDate),
          ingredients,
        });

  if (result.isErr()) {
    return data(
      {
        saveError:
          result.error === "not_found"
            ? "This meal no longer exists. Your changes have not been saved."
            : "Could not save the meal. Your changes are still here; please try again.",
      },
      { status: result.error === "not_found" ? 404 : 500 },
    );
  }
  return redirect(
    input.returnTo && isSafePath(input.returnTo)
      ? input.returnTo
      : "/nutrition",
  );
}

export async function searchAiIngredient(
  userId: UserId,
  input: { readonly query: string },
) {
  try {
    const result = await createNutritionService(userId).searchIngredientWithAI(
      input.query,
    );
    return { aiIngredient: result };
  } catch (error) {
    logger.error({ err: error }, "AI ingredient search error");
    return {
      error: "Failed to search ingredient with AI. Please try again.",
    };
  }
}

export async function saveAiIngredient(
  userId: UserId,
  input: {
    readonly ingredient: CreateIngredientCommand;
  },
) {
  try {
    const result = await createNutritionService(userId).createIngredient({
      ...input.ingredient,
      aiGenerated: true,
      aiGeneratedAt: new Date(),
    });

    if (result.isErr()) {
      throw new Error("Failed to save AI ingredient");
    }

    return { success: true, ingredient: result.value };
  } catch (error) {
    logger.error({ err: error }, "Save AI ingredient error");
    return { error: "Failed to save ingredient. Please try again." };
  }
}
