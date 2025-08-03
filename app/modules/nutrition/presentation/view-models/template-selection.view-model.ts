import type {
  MealTemplate,
  MealCategory,
} from "~/modules/nutrition/domain/meal-template";

export interface TemplateSelectionViewModel {
  readonly mealType: MealCategory;
  readonly mealDisplayName: string;
  readonly templates: readonly TemplateItemViewModel[];
  readonly hasTemplates: boolean;
}

export interface TemplateItemViewModel {
  readonly id: string;
  readonly name: string;
  readonly usageCount: number;
  readonly nutrition: {
    readonly calories: string;
    readonly protein: string;
    readonly carbs: string;
    readonly fat: string;
  };
  readonly notes?: string;
}

function getMealDisplayName(mealType: MealCategory): string {
  const names = {
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    snack: "Snacks",
  };
  return names[mealType];
}

export function createTemplateSelectionViewModel(
  mealType: MealCategory,
  allTemplates: readonly MealTemplate[],
): TemplateSelectionViewModel {
  const filteredTemplates = allTemplates.filter(
    (template) => template.category === mealType,
  );

  return {
    mealType,
    mealDisplayName: getMealDisplayName(mealType),
    templates: filteredTemplates.map((template) => ({
      id: template.id,
      name: template.name,
      usageCount: template.usageCount,
      nutrition: {
        calories: Math.round(template.totalCalories).toString(),
        protein: Math.round(template.totalProtein).toString(),
        carbs: Math.round(template.totalCarbs).toString(),
        fat: Math.round(template.totalFat).toString(),
      },
      notes: template.notes || undefined,
    })),
    hasTemplates: filteredTemplates.length > 0,
  };
}
