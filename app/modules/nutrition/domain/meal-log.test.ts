import { describe, expect, it } from "vitest";
import type { Ingredient, IngredientWithQuantity } from "./ingredient";
import {
  type CreateMealLogInput,
  calculateDailyTotals,
  calculateMealLogNutrition,
  canAddIngredient,
  createDailySummary,
  createMealLog,
  isValidMealLogDate,
  type MealCategory,
  type MealLogWithNutrition,
  removeIngredient,
  updateIngredientQuantity,
} from "./meal-log";

const createTestIngredient = (overrides?: Partial<Ingredient>): Ingredient => ({
  id: "ingredient-1",
  name: "Test Ingredient",
  category: "proteins",
  calories: 100,
  protein: 20,
  carbs: 5,
  fat: 2,
  fiber: 1,
  waterPercentage: 75,
  energyDensity: 1.2,
  texture: "firm_solid",
  isVegetarian: false,
  isVegan: false,
  sliderMin: 10,
  sliderMax: 200,
  aiGenerated: false,
  aiGeneratedAt: null,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: null,
  deletedAt: null,
  ...overrides,
});

const createIngredientWithQuantity = (
  ingredient: Ingredient,
  quantityGrams: number,
): IngredientWithQuantity => ({
  ingredient,
  quantityGrams,
});

const createMealLogInput = (
  overrides?: Partial<CreateMealLogInput>,
): CreateMealLogInput => ({
  mealCategory: "lunch" as MealCategory,
  loggedDate: new Date("2025-01-15"),
  ...overrides,
});

describe("createMealLog", () => {
  it("should create meal log with required fields", () => {
    const input = createMealLogInput({
      mealCategory: "breakfast",
      loggedDate: new Date("2025-01-15"),
    });

    const result = createMealLog(input);

    expect(result.mealCategory).toBe("breakfast");
    expect(result.loggedDate).toEqual(new Date("2025-01-15"));
    expect(result.isCompleted).toBe(false);
    expect(result.notes).toBeNull();
    expect(result.mealTemplateId).toBeNull();
  });

  it("should create meal log with optional fields", () => {
    const input = createMealLogInput({
      mealCategory: "dinner",
      loggedDate: new Date("2025-01-16"),
      notes: "Special preparation",
      mealTemplateId: "template-123",
    });

    const result = createMealLog(input);

    expect(result.mealCategory).toBe("dinner");
    expect(result.loggedDate).toEqual(new Date("2025-01-16"));
    expect(result.isCompleted).toBe(false);
    expect(result.notes).toBe("Special preparation");
    expect(result.mealTemplateId).toBe("template-123");
  });

  it("should handle all meal categories", () => {
    const categories: MealCategory[] = [
      "breakfast",
      "lunch",
      "dinner",
      "snack",
    ];

    for (const category of categories) {
      const input = createMealLogInput({ mealCategory: category });
      const result = createMealLog(input);
      expect(result.mealCategory).toBe(category);
    }
  });
});

describe("calculateMealLogNutrition", () => {
  it("should calculate nutrition totals for single ingredient", () => {
    const ingredient = createTestIngredient({
      calories: 120,
      protein: 25,
      carbs: 10,
      fat: 3,
      fiber: 2,
      waterPercentage: 80,
    });
    const ingredients = [createIngredientWithQuantity(ingredient, 100)];

    const result = calculateMealLogNutrition(ingredients);

    expect(result.calories).toBe(120);
    expect(result.protein).toBe(25);
    expect(result.carbs).toBe(10);
    expect(result.fat).toBe(3);
    expect(result.fiber).toBe(2);
    expect(result.volume).toBe(130); // 100 * (80/100 + 0.5)
  });

  it("should calculate nutrition totals for multiple ingredients", () => {
    const protein = createTestIngredient({
      calories: 120,
      protein: 25,
      carbs: 0,
      fat: 3,
      fiber: 0,
      waterPercentage: 70,
    });
    const vegetable = createTestIngredient({
      calories: 25,
      protein: 2,
      carbs: 5,
      fat: 0,
      fiber: 3,
      waterPercentage: 90,
    });

    const ingredients = [
      createIngredientWithQuantity(protein, 100),
      createIngredientWithQuantity(vegetable, 200),
    ];

    const result = calculateMealLogNutrition(ingredients);

    expect(result.calories).toBe(170); // (120 * 1) + (25 * 2)
    expect(result.protein).toBe(29); // (25 * 1) + (2 * 2)
    expect(result.carbs).toBe(10); // (0 * 1) + (5 * 2)
    expect(result.fat).toBe(3); // (3 * 1) + (0 * 2)
    expect(result.fiber).toBe(6); // (0 * 1) + (3 * 2)
    expect(result.volume).toBe(400); // (100 * 1.2) + (200 * 1.4)
  });

  it("should handle empty ingredients list", () => {
    const ingredients: IngredientWithQuantity[] = [];

    const result = calculateMealLogNutrition(ingredients);

    expect(result.calories).toBe(0);
    expect(result.protein).toBe(0);
    expect(result.carbs).toBe(0);
    expect(result.fat).toBe(0);
    expect(result.fiber).toBe(0);
    expect(result.volume).toBe(0);
  });
});

describe("canAddIngredient", () => {
  it("should return true when ingredient is not already present", () => {
    const ingredient1 = createTestIngredient({ id: "ingredient-1" });
    const ingredient2 = createTestIngredient({ id: "ingredient-2" });
    const currentIngredients = [createIngredientWithQuantity(ingredient1, 100)];
    const newIngredient = createIngredientWithQuantity(ingredient2, 150);

    const result = canAddIngredient(currentIngredients, newIngredient);

    expect(result).toBe(true);
  });

  it("should return false when ingredient is already present", () => {
    const ingredient = createTestIngredient({ id: "ingredient-1" });
    const currentIngredients = [createIngredientWithQuantity(ingredient, 100)];
    const newIngredient = createIngredientWithQuantity(ingredient, 150);

    const result = canAddIngredient(currentIngredients, newIngredient);

    expect(result).toBe(false);
  });

  it("should handle empty current ingredients list", () => {
    const ingredient = createTestIngredient();
    const currentIngredients: IngredientWithQuantity[] = [];
    const newIngredient = createIngredientWithQuantity(ingredient, 100);

    const result = canAddIngredient(currentIngredients, newIngredient);

    expect(result).toBe(true);
  });
});

describe("updateIngredientQuantity", () => {
  it("should update quantity for existing ingredient", () => {
    const ingredient1 = createTestIngredient({ id: "ingredient-1" });
    const ingredient2 = createTestIngredient({ id: "ingredient-2" });
    const ingredients = [
      createIngredientWithQuantity(ingredient1, 100),
      createIngredientWithQuantity(ingredient2, 150),
    ];

    const result = updateIngredientQuantity(ingredients, "ingredient-1", 200);

    expect(result).toHaveLength(2);
    expect(result[0].quantityGrams).toBe(200);
    expect(result[1].quantityGrams).toBe(150);
  });

  it("should remove ingredient when quantity is zero or negative", () => {
    const ingredient1 = createTestIngredient({ id: "ingredient-1" });
    const ingredient2 = createTestIngredient({ id: "ingredient-2" });
    const ingredients = [
      createIngredientWithQuantity(ingredient1, 100),
      createIngredientWithQuantity(ingredient2, 150),
    ];

    const result = updateIngredientQuantity(ingredients, "ingredient-1", 0);

    expect(result).toHaveLength(1);
    expect(result[0].ingredient.id).toBe("ingredient-2");
  });

  it("should return original list when ingredient not found", () => {
    const ingredient = createTestIngredient({ id: "ingredient-1" });
    const ingredients = [createIngredientWithQuantity(ingredient, 100)];

    const result = updateIngredientQuantity(ingredients, "non-existent", 200);

    expect(result).toEqual(ingredients);
  });
});

describe("removeIngredient", () => {
  it("should remove ingredient by id", () => {
    const ingredient1 = createTestIngredient({ id: "ingredient-1" });
    const ingredient2 = createTestIngredient({ id: "ingredient-2" });
    const ingredients = [
      createIngredientWithQuantity(ingredient1, 100),
      createIngredientWithQuantity(ingredient2, 150),
    ];

    const result = removeIngredient(ingredients, "ingredient-1");

    expect(result).toHaveLength(1);
    expect(result[0].ingredient.id).toBe("ingredient-2");
  });

  it("should return original list when ingredient not found", () => {
    const ingredient = createTestIngredient({ id: "ingredient-1" });
    const ingredients = [createIngredientWithQuantity(ingredient, 100)];

    const result = removeIngredient(ingredients, "non-existent");

    expect(result).toEqual(ingredients);
  });

  it("should handle empty ingredients list", () => {
    const ingredients: IngredientWithQuantity[] = [];

    const result = removeIngredient(ingredients, "ingredient-1");

    expect(result).toEqual([]);
  });
});

describe("calculateDailyTotals", () => {
  it("should calculate totals for multiple meals", () => {
    const breakfast: MealLogWithNutrition = {
      id: "log-1",
      mealCategory: "breakfast",
      loggedDate: new Date("2025-01-15"),
      isCompleted: true,
      notes: null,
      mealTemplateId: null,
      createdAt: new Date(),
      updatedAt: null,
      deletedAt: null,
      ingredients: [],
      totals: {
        calories: 400,
        protein: 20,
        carbs: 50,
        fat: 15,
        fiber: 5,
        volume: 300,
      },
    };

    const lunch: MealLogWithNutrition = {
      id: "log-2",
      mealCategory: "lunch",
      loggedDate: new Date("2025-01-15"),
      isCompleted: true,
      notes: null,
      mealTemplateId: null,
      createdAt: new Date(),
      updatedAt: null,
      deletedAt: null,
      ingredients: [],
      totals: {
        calories: 600,
        protein: 35,
        carbs: 40,
        fat: 20,
        fiber: 8,
        volume: 400,
      },
    };

    const meals = [breakfast, lunch];
    const result = calculateDailyTotals(meals);

    expect(result.calories).toBe(1000);
    expect(result.protein).toBe(55);
    expect(result.carbs).toBe(90);
    expect(result.fat).toBe(35);
    expect(result.fiber).toBe(13);
    expect(result.volume).toBe(700);
  });

  it("should handle empty meals list", () => {
    const meals: MealLogWithNutrition[] = [];
    const result = calculateDailyTotals(meals);

    expect(result.calories).toBe(0);
    expect(result.protein).toBe(0);
    expect(result.carbs).toBe(0);
    expect(result.fat).toBe(0);
    expect(result.fiber).toBe(0);
    expect(result.volume).toBe(0);
  });
});

describe("createDailySummary", () => {
  it("should create summary with all meal categories", () => {
    const breakfast: MealLogWithNutrition = {
      id: "log-1",
      mealCategory: "breakfast",
      loggedDate: new Date("2025-01-15"),
      isCompleted: true,
      notes: null,
      mealTemplateId: null,
      createdAt: new Date(),
      updatedAt: null,
      deletedAt: null,
      ingredients: [],
      totals: {
        calories: 400,
        protein: 20,
        carbs: 50,
        fat: 15,
        fiber: 5,
        volume: 300,
      },
    };

    const lunch: MealLogWithNutrition = {
      id: "log-2",
      mealCategory: "lunch",
      loggedDate: new Date("2025-01-15"),
      isCompleted: false,
      notes: null,
      mealTemplateId: null,
      createdAt: new Date(),
      updatedAt: null,
      deletedAt: null,
      ingredients: [],
      totals: {
        calories: 600,
        protein: 35,
        carbs: 40,
        fat: 20,
        fiber: 8,
        volume: 400,
      },
    };

    const logs = [breakfast, lunch];
    const date = new Date("2025-01-15");
    const result = createDailySummary(logs, date);

    expect(result.loggedDate).toEqual(date);
    expect(result.meals.breakfast).toEqual(breakfast);
    expect(result.meals.lunch).toEqual(lunch);
    expect(result.meals.dinner).toBeNull();
    expect(result.meals.snack).toBeNull();
    expect(result.completedMealsCount).toBe(1);
    expect(result.dailyTotals.calories).toBe(1000);
  });

  it("should handle empty logs list", () => {
    const logs: MealLogWithNutrition[] = [];
    const date = new Date("2025-01-15");
    const result = createDailySummary(logs, date);

    expect(result.loggedDate).toEqual(date);
    expect(result.meals.breakfast).toBeNull();
    expect(result.meals.lunch).toBeNull();
    expect(result.meals.dinner).toBeNull();
    expect(result.meals.snack).toBeNull();
    expect(result.completedMealsCount).toBe(0);
    expect(result.dailyTotals.calories).toBe(0);
  });
});

describe("isValidMealLogDate", () => {
  it("should return true for today", () => {
    const today = new Date();
    const result = isValidMealLogDate(today);
    expect(result).toBe(true);
  });

  it("should return true for past dates", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const result = isValidMealLogDate(yesterday);
    expect(result).toBe(true);
  });

  it("should return false for future dates", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const result = isValidMealLogDate(tomorrow);
    expect(result).toBe(false);
  });

  it("should handle time correctly (allow any time today)", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result = isValidMealLogDate(today);
    expect(result).toBe(true);
  });
});
