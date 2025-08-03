import { macrosEnergyPerGram } from "./macros";

interface MiflinStJeorInput {
  age: number;
  height: number;
  activity: number;
  weight: number;
}

interface MacrosSplitInput {
  weight: number;
  calories: number;
}

export interface MacrosSplit {
  protein: number;
  carbs: number;
  fat: number;
}

export const NutritionCalculationService = {
  mifflinStJeor({ age, height, activity, weight }: MiflinStJeorInput): number {
    return activity * (10 * weight + 6.5 * height - 5 * age + 5);
  },
  macrosSplit({ weight, calories }: MacrosSplitInput): MacrosSplit {
    const protein = weight * 1.8;
    const fat = weight;

    const caloriesFromProtein = protein * macrosEnergyPerGram.protein;
    const caloriesFromFat = fat * macrosEnergyPerGram.fat;
    const remainingCalories = calories - caloriesFromFat - caloriesFromProtein;
    const carbs = remainingCalories / macrosEnergyPerGram.carbs;

    return {
      carbs: Math.round(carbs),
      protein: Math.round(protein),
      fat: Math.round(fat),
    };
  },
};
