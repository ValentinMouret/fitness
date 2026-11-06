import type { SharedMealViewModel } from "~/modules/nutrition/presentation/components/SharedMealView/SharedMealView";
export const sharedMeal: SharedMealViewModel = {
  name: "Greek yoghurt, oats and seasonal fruit",
  categories: ["breakfast"],
  notes: "A simple morning meal. Public sample data.",
  ingredients: [
    {
      quantityGrams: 200,
      ingredient: {
        id: "00000000-0000-4000-8000-000000000001",
        name: "Greek yoghurt",
        category: "dairy",
        calories: 80,
        protein: 10,
        carbs: 4,
        fat: 3,
        fiber: 0,
        waterPercentage: 85,
        energyDensity: 0.8,
        texture: "semi_liquid",
        isVegetarian: true,
        isVegan: false,
        sliderMin: 50,
        sliderMax: 400,
        aiGenerated: false,
        aiGeneratedAt: null,
        createdAt: new Date("2026-10-05T00:00:00Z"),
        updatedAt: null,
        deletedAt: null,
      },
    },
  ],
};
