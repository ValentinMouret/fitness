export type Macros = "protein" | "lipids" | "glucides" | "alcool";

export const macrosEnergyPerGram: Record<Macros, number> = {
  glucides: 4,
  protein: 4,
  lipids: 7,
  alcool: 9,
};
