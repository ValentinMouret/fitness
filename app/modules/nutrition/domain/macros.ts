export type Macros = "protein" | "fat" | "carbs" | "alcohol";

export const macrosEnergyPerGram: Record<Macros, number> = {
  carbs: 4,
  protein: 4,
  fat: 9,
  alcohol: 7,
};
