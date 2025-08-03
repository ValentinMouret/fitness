import { describe, it, expect } from "vitest";
import { Ingredient, type IngredientWithQuantity } from "./ingredient";

const createTestIngredient = (overrides?: Partial<Ingredient>): Ingredient => ({
  id: "ingredient-1",
  name: "Test Ingredient",
  category: "proteins",
  calories: 100,
  protein: 20,
  carbs: 10,
  fat: 5,
  fiber: 3,
  waterPercentage: 70,
  energyDensity: 1.5,
  texture: "firm_solid",
  isVegetarian: false,
  isVegan: false,
  sliderMin: 10,
  sliderMax: 200,
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

describe("Ingredient.calculateNutritionForQuantity", () => {
  it("should calculate nutrition for 100g (baseline)", () => {
    const ingredient = createTestIngredient({
      calories: 200,
      protein: 25,
      carbs: 15,
      fat: 8,
      fiber: 4,
      waterPercentage: 60,
    });

    const result = Ingredient.calculateNutritionForQuantity(ingredient, 100);

    expect(result.calories).toBe(200);
    expect(result.protein).toBe(25);
    expect(result.carbs).toBe(15);
    expect(result.fat).toBe(8);
    expect(result.fiber).toBe(4);
    expect(result.volume).toBeCloseTo(110, 1); // 100 * (60/100 + 0.5) = 100 * 1.1
  });

  it("should scale nutrition proportionally for different quantities", () => {
    const ingredient = createTestIngredient({
      calories: 100,
      protein: 20,
      carbs: 10,
      fat: 5,
      fiber: 2,
      waterPercentage: 80,
    });

    const result150g = Ingredient.calculateNutritionForQuantity(
      ingredient,
      150,
    );
    const result50g = Ingredient.calculateNutritionForQuantity(ingredient, 50);

    // 150g should be 1.5x the nutrition
    expect(result150g.calories).toBe(150);
    expect(result150g.protein).toBe(30);
    expect(result150g.carbs).toBe(15);
    expect(result150g.fat).toBe(7.5);
    expect(result150g.fiber).toBe(3);
    expect(result150g.volume).toBe(195); // 150 * (80/100 + 0.5) = 150 * 1.3

    // 50g should be 0.5x the nutrition
    expect(result50g.calories).toBe(50);
    expect(result50g.protein).toBe(10);
    expect(result50g.carbs).toBe(5);
    expect(result50g.fat).toBe(2.5);
    expect(result50g.fiber).toBe(1);
    expect(result50g.volume).toBe(65); // 50 * (80/100 + 0.5) = 50 * 1.3
  });

  it("should handle zero quantity", () => {
    const ingredient = createTestIngredient({
      calories: 100,
      protein: 20,
      carbs: 10,
      fat: 5,
      fiber: 2,
      waterPercentage: 50,
    });

    const result = Ingredient.calculateNutritionForQuantity(ingredient, 0);

    expect(result.calories).toBe(0);
    expect(result.protein).toBe(0);
    expect(result.carbs).toBe(0);
    expect(result.fat).toBe(0);
    expect(result.fiber).toBe(0);
    expect(result.volume).toBe(0);
  });

  it("should handle ingredients with zero nutritional values", () => {
    const ingredient = createTestIngredient({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      waterPercentage: 100,
    });

    const result = Ingredient.calculateNutritionForQuantity(ingredient, 100);

    expect(result.calories).toBe(0);
    expect(result.protein).toBe(0);
    expect(result.carbs).toBe(0);
    expect(result.fat).toBe(0);
    expect(result.fiber).toBe(0);
    expect(result.volume).toBe(150); // 100 * (100/100 + 0.5) = 100 * 1.5
  });

  it("should calculate volume correctly with different water percentages", () => {
    const waterIngredient = createTestIngredient({ waterPercentage: 100 });
    const dryIngredient = createTestIngredient({ waterPercentage: 0 });

    const waterResult = Ingredient.calculateNutritionForQuantity(
      waterIngredient,
      100,
    );
    const dryResult = Ingredient.calculateNutritionForQuantity(
      dryIngredient,
      100,
    );

    expect(waterResult.volume).toBe(150); // 100 * (100/100 + 0.5) = 150
    expect(dryResult.volume).toBe(50); // 100 * (0/100 + 0.5) = 50
  });

  it("should handle fractional quantities", () => {
    const ingredient = createTestIngredient({
      calories: 100,
      protein: 20,
      waterPercentage: 50,
    });

    const result = Ingredient.calculateNutritionForQuantity(ingredient, 33.33);

    expect(result.calories).toBeCloseTo(33.33);
    expect(result.protein).toBeCloseTo(6.666);
    expect(result.volume).toBeCloseTo(33.33); // 33.33 * (50/100 + 0.5) = 33.33 * 1.0
  });
});

describe("Ingredient.calculateTotalNutrition", () => {
  it("should sum nutrition from multiple ingredients", () => {
    const protein = createTestIngredient({
      calories: 120,
      protein: 25,
      carbs: 0,
      fat: 3,
      fiber: 0,
      waterPercentage: 75,
    });
    const carb = createTestIngredient({
      calories: 80,
      protein: 2,
      carbs: 20,
      fat: 0,
      fiber: 1,
      waterPercentage: 10,
    });

    const ingredients = [
      createIngredientWithQuantity(protein, 100),
      createIngredientWithQuantity(carb, 50),
    ];

    const result = Ingredient.calculateTotalNutrition(ingredients);

    expect(result.calories).toBe(160); // (120 * 1) + (80 * 0.5)
    expect(result.protein).toBe(26); // (25 * 1) + (2 * 0.5)
    expect(result.carbs).toBe(10); // (0 * 1) + (20 * 0.5)
    expect(result.fat).toBe(3); // (3 * 1) + (0 * 0.5)
    expect(result.fiber).toBe(0.5); // (0 * 1) + (1 * 0.5)
    expect(result.volume).toBe(155); // (100 * 1.25) + (50 * 0.6) = 125 + 30
  });

  it("should handle empty ingredients list", () => {
    const ingredients: IngredientWithQuantity[] = [];

    const result = Ingredient.calculateTotalNutrition(ingredients);

    expect(result.calories).toBe(0);
    expect(result.protein).toBe(0);
    expect(result.carbs).toBe(0);
    expect(result.fat).toBe(0);
    expect(result.fiber).toBe(0);
    expect(result.volume).toBe(0);
  });

  it("should handle single ingredient", () => {
    const ingredient = createTestIngredient({
      calories: 150,
      protein: 30,
      carbs: 5,
      fat: 8,
      fiber: 2,
      waterPercentage: 65,
    });

    const ingredients = [createIngredientWithQuantity(ingredient, 80)];

    const result = Ingredient.calculateTotalNutrition(ingredients);

    expect(result.calories).toBe(120); // 150 * 0.8
    expect(result.protein).toBe(24); // 30 * 0.8
    expect(result.carbs).toBe(4); // 5 * 0.8
    expect(result.fat).toBe(6.4); // 8 * 0.8
    expect(result.fiber).toBe(1.6); // 2 * 0.8
    expect(result.volume).toBe(92); // 80 * (65/100 + 0.5) = 80 * 1.15
  });

  it("should handle ingredients with zero quantities", () => {
    const ingredient1 = createTestIngredient({
      calories: 100,
      protein: 20,
      carbs: 10,
      fat: 5,
      fiber: 3,
      waterPercentage: 50,
    });
    const ingredient2 = createTestIngredient({
      calories: 200,
      protein: 10,
      carbs: 30,
      fat: 8,
      fiber: 5,
      waterPercentage: 30,
    });

    const ingredients = [
      createIngredientWithQuantity(ingredient1, 0),
      createIngredientWithQuantity(ingredient2, 100),
    ];

    const result = Ingredient.calculateTotalNutrition(ingredients);

    // Should only include nutrition from ingredient2
    expect(result.calories).toBe(200);
    expect(result.protein).toBe(10);
    expect(result.carbs).toBe(30);
    expect(result.fat).toBe(8);
    expect(result.fiber).toBe(5);
    expect(result.volume).toBe(80); // 100 * (30/100 + 0.5) = 100 * 0.8
  });

  it("should handle complex multi-ingredient meals", () => {
    const chicken = createTestIngredient({
      id: "chicken",
      name: "Chicken Breast",
      calories: 165,
      protein: 31,
      carbs: 0,
      fat: 3.6,
      fiber: 0,
      waterPercentage: 65,
    });
    const rice = createTestIngredient({
      id: "rice",
      name: "Brown Rice",
      calories: 111,
      protein: 2.6,
      carbs: 23,
      fat: 0.9,
      fiber: 1.8,
      waterPercentage: 70,
    });
    const broccoli = createTestIngredient({
      id: "broccoli",
      name: "Broccoli",
      calories: 34,
      protein: 2.8,
      carbs: 7,
      fat: 0.4,
      fiber: 2.6,
      waterPercentage: 89,
    });

    const ingredients = [
      createIngredientWithQuantity(chicken, 150), // 1.5 servings
      createIngredientWithQuantity(rice, 75), // 0.75 servings
      createIngredientWithQuantity(broccoli, 200), // 2 servings
    ];

    const result = Ingredient.calculateTotalNutrition(ingredients);

    expect(result.calories).toBeCloseTo(398.75); // (165*1.5) + (111*0.75) + (34*2) = 247.5 + 83.25 + 68
    expect(result.protein).toBeCloseTo(54.05); // (31*1.5) + (2.6*0.75) + (2.8*2) = 46.5 + 1.95 + 5.6
    expect(result.carbs).toBeCloseTo(31.25); // (0*1.5) + (23*0.75) + (7*2) = 0 + 17.25 + 14
    expect(result.fat).toBeCloseTo(6.875); // (3.6*1.5) + (0.9*0.75) + (0.4*2) = 5.4 + 0.675 + 0.8
    expect(result.fiber).toBeCloseTo(6.55); // (0*1.5) + (1.8*0.75) + (2.6*2) = 0 + 1.35 + 5.2
  });

  it("should maintain precision with decimal quantities", () => {
    const ingredient = createTestIngredient({
      calories: 100,
      protein: 20,
      carbs: 10,
      fat: 5,
      fiber: 2,
      waterPercentage: 80,
    });

    const ingredients = [
      createIngredientWithQuantity(ingredient, 66.67),
      createIngredientWithQuantity(ingredient, 33.33),
    ];

    const result = Ingredient.calculateTotalNutrition(ingredients);

    // Should be equivalent to 100g total
    expect(result.calories).toBeCloseTo(100, 1);
    expect(result.protein).toBeCloseTo(20, 1);
    expect(result.carbs).toBeCloseTo(10, 1);
    expect(result.fat).toBeCloseTo(5, 1);
    expect(result.fiber).toBeCloseTo(2, 1);
  });
});
