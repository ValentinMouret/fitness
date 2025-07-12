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
  glucides: number;
  lipids: number;
}

export const NutritionService = {
  mifflinStJeor({ age, height, activity, weight }: MiflinStJeorInput): number {
    return activity * (10 * weight + 6.5 * height - 5 * age + 5);
  },
  macrosSplit({ weight, calories }: MacrosSplitInput): MacrosSplit {
    const protein = weight * 1.8;
    const lipids = weight;

    const caloriesFromProtein = protein * macrosEnergyPerGram.protein;
    const caloriesFromLipids = lipids * macrosEnergyPerGram.lipids;
    const remainingCalories =
      calories - caloriesFromLipids - caloriesFromProtein;
    const glucides = remainingCalories / macrosEnergyPerGram.glucides;

    return {
      glucides: Math.round(glucides),
      protein: Math.round(protein),
      lipids: Math.round(lipids),
    };
  },
};
