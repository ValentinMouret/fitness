import type { MealLogWithNutrition } from "~/modules/nutrition/domain/meal-log";
import { formatStartedAgo } from "~/time";

export interface MealCardViewModel {
  readonly id: string;
  readonly displayName: string;
  readonly statusIcon: string;
  readonly timeAgo: string;
  readonly nutrition: {
    readonly calories: string;
    readonly protein: string;
    readonly carbs: string;
    readonly fat: string;
  };
  readonly ingredients: readonly {
    readonly id: string;
    readonly name: string;
    readonly icon: string;
    readonly quantity: string;
  }[];
  readonly isFromTemplate: boolean;
  readonly isCompleted: boolean;
}

function getIngredientIcon(name: string): string {
  const iconMap: Record<string, string> = {
    "Chicken Breast": "🍗",
    "Rolled Oats": "🥣",
    Blueberries: "🫐",
    "Greek Yogurt": "🥛",
    Honey: "🍯",
    "Romaine Lettuce": "🥬",
    "Caesar Dressing": "🥗",
    "Parmesan Cheese": "🧀",
    "Brown Rice": "🍚",
    Broccoli: "🥦",
    "Olive Oil": "🫒",
    "Apple, Medium": "🍎",
    Almonds: "🌰",
  };
  return iconMap[name] || "🥘";
}

export function createMealCardViewModel(
  meal: MealLogWithNutrition,
): MealCardViewModel {
  const totalNutrition = meal.totals;
  const isFromTemplate = meal.mealTemplateId !== null;

  return {
    id: meal.id,
    displayName: isFromTemplate ? "Template Meal" : "Custom Meal",
    statusIcon:
      isFromTemplate && meal.isCompleted
        ? "✅✓"
        : isFromTemplate
          ? "✓"
          : meal.isCompleted
            ? "✅"
            : "",
    timeAgo: formatStartedAgo(
      Math.floor((Date.now() - meal.createdAt.getTime()) / (1000 * 60)),
    ),
    nutrition: {
      calories: Math.round(totalNutrition.calories).toString(),
      protein: Math.round(totalNutrition.protein).toString(),
      carbs: Math.round(totalNutrition.carbs).toString(),
      fat: Math.round(totalNutrition.fat).toString(),
    },
    ingredients: meal.ingredients.map((ingredientWithQuantity) => ({
      id: ingredientWithQuantity.ingredient.id,
      name: ingredientWithQuantity.ingredient.name,
      icon: getIngredientIcon(ingredientWithQuantity.ingredient.name),
      quantity: `${ingredientWithQuantity.quantityGrams}g`,
    })),
    isFromTemplate,
    isCompleted: meal.isCompleted,
  };
}
