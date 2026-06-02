const INGREDIENT_ICONS: Record<string, string> = {
  "Chicken Breast": "🍗",
  "Beef, Lean Ground": "🥩",
  "Eggs, Whole": "🥚",
  "Tofu, Firm": "🧊",
  "Salmon, Atlantic": "🐟",
  "Greek Yogurt": "🥛",
  "Milk, Whole": "🥛",
  "Cheddar Cheese": "🧀",
  "White Rice, Cooked": "🍚",
  "Brown Rice, Cooked": "🍚",
  "Pasta, Cooked": "🍝",
  "Oats, Rolled": "🥣",
  "Sweet Potato": "🍠",
  "Quinoa, Cooked": "🌾",
  "Broccoli, Steamed": "🥦",
  "Spinach, Raw": "🥬",
  "Bell Pepper": "🫑",
  Carrots: "🥕",
  Tomatoes: "🍅",
  "Olive Oil": "🫒",
  Avocado: "🥑",
  Almonds: "🌰",
  "Peanut Butter": "🥜",
};

export function getIngredientIcon(name: string): string {
  return INGREDIENT_ICONS[name] || "🥘";
}
