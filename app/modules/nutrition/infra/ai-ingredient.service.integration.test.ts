import { describe, expect, it } from "vitest";
import { AIIngredientService } from "./ai-ingredient.service";

describe("AIIngredientService (integration)", () => {
  it(
    "should find Huel Protein with accurate nutritional data from the web",
    async () => {
      const result = await AIIngredientService.searchIngredient("Huel Protein");

      expect(result.isOk()).toBe(true);

      const searchResult = result._unsafeUnwrap();
      expect(searchResult.found).toBe(true);

      const data = searchResult.data;

      // Huel Daily A-Z Protein (per 100g of powder):
      // ~400 kcal, ~80g protein, ~9g carbs, ~4g fat
      // Allow some tolerance for AI interpretation.
      expect(data.name.toLowerCase()).toContain("huel");
      expect(data.protein).toBeGreaterThanOrEqual(60);
      expect(data.calories).toBeGreaterThanOrEqual(300);
      expect(data.calories).toBeLessThanOrEqual(500);
      expect(data.texture).toBe("powder");
      expect(data.isVegan).toBe(true);
      expect(data.aiGenerated).toBe(true);
    },
    { timeout: 30_000 },
  );
});
