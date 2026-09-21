import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import pg from "pg";

const databaseUrl = process.env.E2E_DATABASE_URL;
const pool = new pg.Pool({ connectionString: databaseUrl });
test.skip(!databaseUrl, "Set E2E_DATABASE_URL to a dedicated test database");
test.describe.configure({ mode: "default" });
test.use({ viewport: { width: 390, height: 844 } });
let mealId: string;
let foodId: string;
let foodName: string;
const date = "1901-02-01";
const editUrl = () =>
  `/nutrition/meal-builder?meal=lunch&date=${date}&mealId=${mealId}&returnTo=${encodeURIComponent(`/nutrition?date=${date}`)}`;

test.beforeEach(async ({ request }) => {
  mealId = randomUUID();
  foodId = randomUUID();
  foodName = `Meal test ${foodId}`;
  const created = await request.post("/nutrition/meal-builder", {
    form: {
      intent: "save-ai-ingredient",
      ingredientData: JSON.stringify({
        name: foodName,
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
        sliderMax: 500,
        isVegetarian: false,
        isVegan: false,
      }),
    },
  });
  expect(created.ok()).toBe(true);
  const food = await pool.query<{ id: string }>(
    "select id from ingredients where name = $1",
    [foodName],
  );
  foodId = food.rows[0].id;
  await pool.query(
    `insert into meal_logs (id, meal_category, logged_date, notes, is_completed) values ($1, 'lunch', $2, 'Preserved notes', true)`,
    [mealId, date],
  );
  await pool.query(
    `insert into meal_log_ingredients (meal_log_id, ingredient_id, quantity_grams) values ($1, $2, 100)`,
    [mealId, foodId],
  );
});
test.afterEach(async () => {
  await pool.query("delete from meal_log_ingredients where meal_log_id = $1", [
    mealId,
  ]);
  await pool.query("delete from meal_logs where id = $1", [mealId]);
  await pool.query("delete from ingredients where id = $1", [foodId]);
});
test.afterAll(async () => {
  await pool.end();
});

test("updates quantities, redirects and persists after reopening", async ({
  page,
}) => {
  await page.goto(editUrl());
  const slider = page
    .getByLabel(`Quantity for ${foodName}`)
    .getByRole("slider");
  await expect(slider).toHaveAttribute("aria-valuenow", "100");
  await slider.press("ArrowRight");
  await page.getByRole("button", { name: "Update Meal" }).click();
  await expect(page).toHaveURL(`/nutrition?date=${date}`);
  await page.goto(editUrl());
  await expect(slider).toHaveAttribute("aria-valuenow", "105");
  await page.getByRole("button", { name: "Update Meal" }).click();
  await expect(page).toHaveURL(`/nutrition?date=${date}`);
  const saved = await pool.query(
    "select notes, is_completed from meal_logs where id = $1",
    [mealId],
  );
  expect(saved.rows[0]).toEqual({
    notes: "Preserved notes",
    is_completed: true,
  });
});

test("does not offer an already selected ingredient again", async ({
  page,
}) => {
  await page.goto(editUrl());
  await expect(
    page.getByLabel(`Quantity for ${foodName}`).getByRole("slider"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add Ingredient (N)" }).click();
  await page
    .getByRole("textbox", { name: "Search ingredients" })
    .fill(foodName);
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: new RegExp(foodName) }),
  ).toHaveCount(0);
});

test("preserves unsaved quantities when the same meal loader revalidates", async ({
  page,
}) => {
  const params = new URLSearchParams({
    meal: "lunch",
    date,
    mealId,
    returnTo: editUrl(),
  });
  await page.goto(`/nutrition/meal-builder?${params}`);
  const slider = page
    .getByLabel(`Quantity for ${foodName}`)
    .getByRole("slider");
  await slider.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuenow", "105");
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(editUrl());
  await expect(slider).toHaveAttribute("aria-valuenow", "105");
});

test("ignores stale quick estimates when editing", async ({ page }) => {
  await page.addInitScript(
    ({ id }) => {
      sessionStorage.setItem(
        "quickEstimate",
        JSON.stringify({ ingredients: [{ ingredientId: id, quantity: 400 }] }),
      );
    },
    { id: foodId },
  );
  await page.goto(editUrl());
  await expect(
    page.getByLabel(`Quantity for ${foodName}`).getByRole("slider"),
  ).toHaveAttribute("aria-valuenow", "100");
});

test("keeps the draft and shows a recoverable error if a meal disappears before saving", async ({
  page,
}) => {
  await page.goto(editUrl());
  const slider = page
    .getByLabel(`Quantity for ${foodName}`)
    .getByRole("slider");
  await slider.press("ArrowRight");
  await pool.query("update meal_logs set deleted_at = now() where id = $1", [
    mealId,
  ]);
  await page.getByRole("button", { name: "Update Meal" }).click();
  await expect(page.getByRole("alert")).toContainText("no longer exists");
  await expect(slider).toHaveAttribute("aria-valuenow", "105");
  await pool.query("update meal_logs set deleted_at = null where id = $1", [
    mealId,
  ]);
  await page.getByRole("button", { name: "Update Meal" }).click();
  await expect(page).toHaveURL(`/nutrition?date=${date}`);
});

test("loads a matching quick estimate into its create session", async ({
  page,
}) => {
  const estimateId = randomUUID();
  await page.addInitScript(
    ({ id, token, day }) => {
      sessionStorage.setItem(
        "quickEstimate",
        JSON.stringify({
          estimateId: token,
          date: day,
          mealCategory: "snack",
          ingredients: [{ ingredientId: id, quantity: 175 }],
        }),
      );
    },
    { id: foodId, token: estimateId, day: date },
  );
  await page.goto(
    `/nutrition/meal-builder?meal=snack&date=${date}&estimate=${estimateId}`,
  );
  await expect(
    page.getByLabel(`Quantity for ${foodName}`).getByRole("slider"),
  ).toHaveAttribute("aria-valuenow", "175");
  await expect(
    page.getByRole("button", { name: "Save Meal", exact: true }),
  ).toBeEnabled();
});

test("resets the draft when navigating from edit to a new meal", async ({
  page,
}) => {
  const destination = `/nutrition/meal-builder?meal=snack&date=${date}`;
  await page.goto(
    `/nutrition/meal-builder?${new URLSearchParams({ mealId, returnTo: destination })}`,
  );
  await page
    .getByLabel(`Quantity for ${foodName}`)
    .getByRole("slider")
    .press("ArrowRight");
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(destination);
  await expect(
    page.getByRole("heading", {
      name: "Selected Ingredients (0)",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save Meal", exact: true }),
  ).toBeDisabled();
});
