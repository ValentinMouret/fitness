import { redirect } from "react-router";
import { NutritionService } from "~/modules/nutrition/application/service";
import type { CreateAIIngredientInput } from "~/modules/nutrition/domain/ingredient";
import type {
  CreateMealTemplateInput,
  MealCategory,
} from "~/modules/nutrition/domain/meal-template";

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
    }
  }

  return {
    ingredients: ingredientsResult.value,
    mealTemplates: templatesResult.value,
    mealLoggingMode: {
      isEnabled: Boolean(input.mealCategory && input.date && input.returnTo),
      mealCategory: input.mealCategory,
      date: input.date,
      returnTo: input.returnTo,
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

export async function saveMealLog(input: {
  readonly mealCategory: MealCategory;
  readonly loggedDate: string;
  readonly ingredientsJson: string;
  readonly returnTo?: string;
  readonly mealId?: string;
  readonly notes?: string;
}) {
  try {
    const ingredientsData = JSON.parse(input.ingredientsJson);
    const parsedDate = new Date(input.loggedDate);

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

    let result: Awaited<
      ReturnType<
        | typeof NutritionService.createMealLog
        | typeof NutritionService.updateMealLog
      >
    >;
    if (input.mealId) {
      result = await NutritionService.updateMealLog(input.mealId, {
        ingredients,
        notes: input.notes,
      });
    } else {
      result = await NutritionService.createMealLog({
        mealCategory: input.mealCategory,
        loggedDate: parsedDate,
        ingredients,
        notes: input.notes,
      });
    }

    if (result.isErr()) {
      throw new Error("Failed to save meal");
    }

    return redirect(input.returnTo || "/nutrition/meals");
  } catch (_error) {
    throw new Error("Invalid meal data");
  }
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
