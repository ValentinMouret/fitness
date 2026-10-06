import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import pg from "pg";
import {
  canWriteFixtureDatabase,
  verifyFixtureServerDatabase,
} from "./support/fixture-database";

const databaseUrl = process.env.E2E_DATABASE_URL;
test.skip(
  !canWriteFixtureDatabase(databaseUrl),
  "Requires isolated CI DB or explicit local E2E_ALLOW_FIXTURE_WRITES with matching test DB/server",
);
test.use({ viewport: { width: 390, height: 844 } });

test("meal composition, templates and logged edits survive retired suggestions", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const token = randomUUID();
  const ingredientName = `Retirement ingredient ${token}`;
  const templateName = `Retirement meal ${token}`;
  const seed = Number.parseInt(token.slice(0, 8), 16);
  const date = `${1800 + (seed % 100)}-${String(1 + (seed % 12)).padStart(2, "0")}-${String(1 + (seed % 28)).padStart(2, "0")}`;
  let ingredientId: string | undefined;
  let templateId: string | undefined;
  let mealId: string | undefined;
  try {
    await verifyFixtureServerDatabase(request, pool);
    const created = await request.post("/nutrition/meal-builder", {
      form: {
        intent: "save-ai-ingredient",
        ingredientData: JSON.stringify({
          name: ingredientName,
          category: "proteins",
          texture: "firm_solid",
          calories: 100,
          protein: 20,
          carbs: 5,
          fat: 2,
          fiber: 1,
          waterPercentage: 70,
          energyDensity: 1,
          sliderMin: 5,
          sliderMax: 195,
          isVegetarian: false,
          isVegan: false,
        }),
      },
    });
    expect(created.ok()).toBe(true);
    ingredientId = (
      await pool.query<{ id: string }>(
        "select id from ingredients where name = $1",
        [ingredientName],
      )
    ).rows[0].id;
    await page.goto("/nutrition/meal-builder");
    await expect(
      page.getByRole("button", { name: "AI Suggest", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText(/satiety|fullness/i)).toHaveCount(0);
    await page.getByPlaceholder("Enter protein").fill("30");
    await page.getByRole("button", { name: "Add Ingredient (N)" }).click();
    const picker = page.getByRole("dialog");
    await picker
      .getByRole("textbox", { name: "Search ingredients" })
      .fill(ingredientName);
    await picker
      .getByRole("button", { name: new RegExp(`^${ingredientName}( |$)`) })
      .click();
    await expect(
      page.getByRole("progressbar", { name: "Protein progress" }),
    ).toHaveAttribute("aria-valuenow", "20");
    await expect(
      page.getByRole("progressbar", { name: "Protein progress" }),
    ).toHaveAttribute("aria-valuemax", "30");
    await expect(
      page.getByRole("progressbar", { name: "Calories progress" }),
    ).toHaveAttribute("aria-valuenow", "100");
    await expect(
      page.getByRole("progressbar", { name: "Carbs progress" }),
    ).toHaveAttribute("aria-valuenow", "5");
    await expect(
      page.getByRole("progressbar", { name: "Fats progress" }),
    ).toHaveAttribute("aria-valuenow", "2");
    await page
      .getByRole("button", { name: "Save Template", exact: true })
      .click();
    const saveDialog = page.getByRole("alertdialog");
    await saveDialog
      .getByPlaceholder("e.g., Post-workout meal")
      .fill(templateName);
    await saveDialog
      .getByRole("checkbox", { name: "Lunch", exact: true })
      .check();
    await saveDialog
      .getByRole("button", { name: "Save Template", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (
            await pool.query("select id from meal_templates where name = $1", [
              templateName,
            ])
          ).rowCount,
      )
      .toBe(1);
    templateId = (
      await pool.query<{ id: string; satiety_score: number }>(
        "select id, satiety_score from meal_templates where name = $1",
        [templateName],
      )
    ).rows[0].id;
    // A pre-existing stored value must survive applying and editing its meal.
    await pool.query(
      "update meal_templates set satiety_score = 42.5 where id = $1",
      [templateId],
    );
    await page.goto(`/nutrition?date=${date}`);
    await page.getByRole("button", { name: "Meal actions for Lunch" }).click();
    await page
      .getByRole("menuitem", { name: "Use template", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: new RegExp(`^${templateName}( |$)`) })
      .click();
    await expect(page.getByRole("link", { name: "Edit Lunch" })).toBeVisible();
    mealId = (
      await pool.query<{ id: string }>(
        "select id from meal_logs where meal_template_id = $1 and logged_date = $2",
        [templateId, date],
      )
    ).rows[0].id;
    await page.getByRole("link", { name: "Edit Lunch" }).click();
    await expect(page.getByText(/satiety|fullness/i)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "AI Suggest", exact: true }),
    ).toHaveCount(0);
    const slider = page
      .getByLabel(`Quantity for ${ingredientName}`)
      .getByRole("slider");
    await expect(slider).toHaveAttribute("aria-valuenow", "100");
    await slider.press("ArrowRight");
    await expect(slider).toHaveAttribute("aria-valuenow", "105");
    await expect(
      page.getByRole("progressbar", { name: "Calories progress" }),
    ).toHaveAttribute("aria-valuenow", "105");
    await expect(
      page.getByRole("progressbar", { name: "Protein progress" }),
    ).toHaveAttribute("aria-valuenow", "21");
    await page.getByRole("button", { name: "Update Meal" }).click();
    await expect(page).toHaveURL(`/nutrition?date=${date}`);
    await page.reload();
    await page.getByRole("link", { name: "Edit Lunch" }).click();
    await expect(slider).toHaveAttribute("aria-valuenow", "105");
    const stored = await pool.query(
      "select quantity_grams from meal_log_ingredients where meal_log_id = $1 and ingredient_id = $2",
      [mealId, ingredientId],
    );
    expect(stored.rows).toEqual([{ quantity_grams: 105 }]);
    const template = await pool.query(
      "select satiety_score, total_calories, total_protein, total_carbs, total_fat from meal_templates where id = $1",
      [templateId],
    );
    expect(template.rows).toEqual([
      {
        satiety_score: 42.5,
        total_calories: 100,
        total_protein: 20,
        total_carbs: 5,
        total_fat: 2,
      },
    ]);
    const templateIngredient = await pool.query(
      "select quantity_grams from meal_template_ingredients where meal_template_id = $1 and ingredient_id = $2",
      [templateId, ingredientId],
    );
    expect(templateIngredient.rows).toEqual([{ quantity_grams: 100 }]);
  } finally {
    try {
      // Resolve fixtures by their unique names even if an assertion interrupted creation.
      await pool.query(
        "delete from meal_log_ingredients where meal_log_id in (select id from meal_logs where meal_template_id in (select id from meal_templates where name = $1))",
        [templateName],
      );
      await pool.query(
        "delete from meal_logs where meal_template_id in (select id from meal_templates where name = $1)",
        [templateName],
      );
      await pool.query(
        "delete from meal_template_ingredients where meal_template_id in (select id from meal_templates where name = $1)",
        [templateName],
      );
      await pool.query("delete from meal_templates where name = $1", [
        templateName,
      ]);
      await pool.query("delete from ingredients where name = $1", [
        ingredientName,
      ]);
    } finally {
      await pool.end();
    }
  }
});
