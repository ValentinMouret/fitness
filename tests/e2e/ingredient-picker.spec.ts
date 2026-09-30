import { randomUUID } from "node:crypto";
import { test as base, expect } from "@playwright/test";
import pg from "pg";
import {
  canWriteFixtureDatabase,
  verifyFixtureServerDatabase,
} from "./support/fixture-database";

const test = base.extend<{ readonly ingredientName: string }>({
  ingredientName: async ({ request }, use) => {
    const pool = new pg.Pool({
      connectionString: process.env.E2E_DATABASE_URL,
    });
    const id = randomUUID();
    const name = `Picker ingredient ${id}`;
    try {
      await verifyFixtureServerDatabase(request, pool);
      const created = await request.post("/nutrition/meal-builder", {
        form: {
          intent: "save-ai-ingredient",
          ingredientData: JSON.stringify({
            name,
            category: "proteins",
            calories: 100,
            protein: 20,
            carbs: 5,
            fat: 2,
            fiber: 1,
            waterPercentage: 70,
            energyDensity: 1,
            texture: "firm_solid",
            sliderMin: 5,
            sliderMax: 500,
            isVegetarian: false,
            isVegan: false,
          }),
        },
      });
      expect(created.ok()).toBe(true);
      await use(name);
    } finally {
      await pool.query("delete from ingredients where name = $1", [name]);
      await pool.end();
    }
  },
});
test.skip(
  !canWriteFixtureDatabase(process.env.E2E_DATABASE_URL),
  "Requires a matching dedicated fixture database/server",
);

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test.beforeEach(async ({ page, ingredientName }) => {
  await page.goto("/nutrition/meal-builder?meal=breakfast");
  await page.getByRole("button", { name: "Add Ingredient (N)" }).tap();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search ingredients" })
    .fill(ingredientName);
});

test("first touch closes the ingredient picker", async ({ page }) => {
  await page.getByRole("button", { name: "Close", exact: true }).tap();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("search and selection still work after closing and reopening", async ({
  page,
  ingredientName,
}) => {
  const picker = page.getByRole("dialog");
  const search = picker.getByRole("textbox", { name: "Search ingredients" });
  await expect(search).toBeFocused();
  await search.fill(ingredientName);
  const ingredient = picker.getByRole("button", {
    name: `${ingredientName} (1)`,
    exact: true,
  });
  await expect(ingredient).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).tap();
  await expect(picker).toHaveCount(0);
  await page.getByRole("button", { name: "Add Ingredient (N)" }).tap();
  await expect(search).toBeFocused();
  await expect(search).toHaveValue(ingredientName);
  await search.press("Escape");
  await expect(picker).toHaveCount(0);
  await page.getByRole("button", { name: "Add Ingredient (N)" }).tap();
  await ingredient.tap();
  await expect(picker).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Selected Ingredients (1)" }),
  ).toBeVisible();
});
