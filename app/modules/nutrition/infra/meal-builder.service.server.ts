import { ResultAsync } from "neverthrow";
import { data, redirect } from "react-router";
import type { CreateAIIngredientInput } from "~/modules/nutrition/domain/ingredient";
import type {
  CreateMealTemplateInput,
  MealCategory,
} from "~/modules/nutrition/domain/meal-template";
import { NutritionService } from "~/modules/nutrition/infra/service";
import { fromDateString, toDateString } from "~/time";
import { isSafePath } from "~/utils";
import type { NotEmpty } from "~/utils/types";
import {
  type MealIngredientInput,
  validateMealComposition,
} from "../domain/meal-composition";

export async function getMealBuilderData(input: {
  readonly searchTerm?: string;
  readonly category?: string;
  readonly mealCategory: MealCategory | null;
  readonly date: string | null;
  readonly returnTo: string | null;
  readonly mealId: string | null;
}) {
  const [ingredientsResult, templatesResult] = await Promise.all([
    NutritionService.searchIngredients(input.searchTerm, input.category),
    NutritionService.getAllMealTemplates(),
  ]);

  if (ingredientsResult.isErr()) {
    throw new Error("Failed to load ingredients");
  }

  if (templatesResult.isErr()) {
    throw new Error("Failed to load meal templates");
  }

  let existingMeal = null;
  if (input.mealId) {
    const mealResult = await NutritionService.getMealLogWithIngredients(
      input.mealId,
    );
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

export async function saveMealTemplate(input: {
  readonly name: string;
  readonly category: MealCategory;
  readonly notes?: string;
  readonly ingredientsJson: string;
}) {
  try {
    const ingredientsData = JSON.parse(input.ingredientsJson);

    const ingredients = await Promise.all(
      ingredientsData.map(async (item: { id: string; quantity: number }) => {
        const ingredientResult = await NutritionService.getIngredientById(
          item.id,
        );
        if (ingredientResult.isErr()) {
          throw new Error(`Failed to find ingredient: ${item.id}`);
        }
        return {
          ingredient: ingredientResult.value,
          quantityGrams: item.quantity,
        };
      }),
    );

    const templateInput: CreateMealTemplateInput = {
      name: input.name,
      category: input.category,
      notes: input.notes,
      ingredients,
    };

    const result = await NutritionService.createMealTemplate(templateInput);

    if (result.isErr()) {
      throw new Error("Failed to save meal template");
    }

    return { success: true, template: result.value };
  } catch (_error) {
    throw new Error("Invalid ingredient data");
  }
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

export async function saveMealLog(input: SaveMealLogInput) {
  if (validateMealComposition(input.ingredients).isErr()) {
    return data(
      {
        saveError:
          "Choose at least one ingredient with a positive quantity, without duplicates.",
      },
      { status: 400 },
    );
  }
  const ingredientsResult = await ResultAsync.combine(
    input.ingredients.map((item) =>
      NutritionService.getIngredientById(item.id).map((ingredient) => ({
        ingredient,
        quantityGrams: item.quantity,
      })),
    ),
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
      ? await NutritionService.updateMealLog(input.mealId, { ingredients })
      : await NutritionService.createMealLog({
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

export async function searchAiIngredient(input: { readonly query: string }) {
  try {
    const result = await NutritionService.searchIngredientWithAI(input.query);
    return { aiIngredient: result };
  } catch (error) {
    console.error("AI ingredient search error:", error);
    return {
      error: "Failed to search ingredient with AI. Please try again.",
    };
  }
}

export async function saveAiIngredient(input: {
  readonly ingredientDataJson: string;
}) {
  try {
    const ingredientData: CreateAIIngredientInput = JSON.parse(
      input.ingredientDataJson,
    );
    const result = await NutritionService.createIngredient(ingredientData);

    if (result.isErr()) {
      throw new Error("Failed to save AI ingredient");
    }

    return { success: true, ingredient: result.value };
  } catch (error) {
    console.error("Save AI ingredient error:", error);
    return { error: "Failed to save ingredient. Please try again." };
  }
}
