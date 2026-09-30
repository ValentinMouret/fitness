import { randomUUID } from "node:crypto";
import { test as base, expect } from "@playwright/test";
import pg from "pg";
import {
  canWriteFixtureDatabase,
  verifyFixtureServerDatabase,
} from "./support/fixture-database";

const databaseUrl = process.env.E2E_DATABASE_URL;
const test = base.extend<{
  readonly fixture: {
    readonly pool: pg.Pool;
    readonly rice: string;
    readonly oats: string;
    readonly ingredient: string;
    readonly food: string;
    readonly riceName: string;
    readonly oatsName: string;
  };
}>({
  fixture: async ({ request }, use) => {
    const pool = new pg.Pool({ connectionString: databaseUrl });
    const rice = randomUUID(),
      oats = randomUUID();
    const food = `Assignment food ${randomUUID()}`;
    const riceName = `Rice and chicken ${rice}`,
      oatsName = `Morning oatmeal ${oats}`;
    let ingredient = "";
    try {
      await verifyFixtureServerDatabase(request, pool);
      const response = await request.post("/nutrition/meal-builder", {
        form: {
          intent: "save-ai-ingredient",
          ingredientData: JSON.stringify({
            name: food,
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
      expect(response.ok()).toBe(true);
      ingredient = (
        await pool.query("select id from ingredients where name = $1", [food])
      ).rows[0].id;
      for (const [id, name, category] of [
        [rice, riceName, "lunch"],
        [oats, oatsName, "breakfast"],
      ]) {
        await pool.query(
          "insert into meal_templates (id,name,categories,total_calories,total_protein,total_carbs,total_fat,total_fiber,satiety_score) values ($1,$2,array[$3]::meal_category[],100,20,5,2,1,1)",
          [id, name, category],
        );
        await pool.query(
          "insert into meal_template_ingredients (meal_template_id,ingredient_id,quantity_grams) values ($1,$2,100)",
          [id, ingredient],
        );
      }
      await use({ pool, rice, oats, ingredient, food, riceName, oatsName });
    } finally {
      await pool.query(
        "delete from meal_log_ingredients where meal_log_id in (select id from meal_logs where meal_template_id = any($1::uuid[]))",
        [[rice, oats]],
      );
      await pool.query(
        "delete from meal_logs where meal_template_id = any($1::uuid[])",
        [[rice, oats]],
      );
      await pool.query(
        "delete from meal_template_ingredients where meal_template_id = any($1::uuid[])",
        [[rice, oats]],
      );
      await pool.query(
        "delete from meal_templates where id = any($1::uuid[])",
        [[rice, oats]],
      );
      if (ingredient)
        await pool.query("delete from ingredients where id = $1", [ingredient]);
      await pool.end();
    }
  },
});
test.skip(
  !canWriteFixtureDatabase(databaseUrl),
  "Requires a matching dedicated fixture database/server",
);
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test("explicit assignments filter management and log one composition in the chosen meal context", async ({
  page,
  fixture,
}) => {
  test.setTimeout(30000);
  const { pool, rice, riceName, oatsName } = fixture;
  await page.goto("/nutrition/templates?meal=all");
  await expect(
    page.getByRole("heading", { name: riceName, exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Lunch", exact: true }).click();
  await page
    .getByRole("link", { name: `Edit ${riceName}`, exact: true })
    .click();
  await page.getByRole("checkbox", { name: "Dinner", exact: true }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/meal=lunch$/);
  await page.getByRole("button", { name: "Dinner", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: riceName, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: `Edit ${riceName}`, exact: true })
    .click();
  await page.getByRole("checkbox", { name: "Dinner", exact: true }).uncheck();
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/meal=dinner$/);
  expect(
    (
      await pool.query(
        "select categories::text[] as categories from meal_templates where id=$1",
        [rice],
      )
    ).rows[0].categories,
  ).toEqual(["lunch", "dinner"]);
  const date = "1905-05-07";
  expect(
    (await pool.query("select id from meal_logs where logged_date=$1", [date]))
      .rows,
  ).toHaveLength(0);
  await page.goto(`/nutrition?date=${date}`);
  await page
    .getByRole("button", { name: "Use template for Breakfast", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: new RegExp(`^${riceName}`) }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: new RegExp(`^${oatsName}`) }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Close (Esc)", exact: true })
    .click();
  for (const meal of ["Lunch", "Dinner"]) {
    await page
      .getByRole("button", { name: `Use template for ${meal}`, exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByRole("button", { name: new RegExp(`^${riceName}`) })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect
      .poll(
        async () =>
          (
            await pool.query(
              "select meal_category from meal_logs where meal_template_id=$1 and logged_date=$2",
              [rice, date],
            )
          ).rows.length,
      )
      .toBe(meal === "Lunch" ? 1 : 2);
  }
  const logs = (
    await pool.query(
      "select to_jsonb(l) as record from meal_logs l where meal_template_id=$1 order by meal_category",
      [rice],
    )
  ).rows;
  expect(logs.map(({ record }) => record.meal_category).sort()).toEqual([
    "dinner",
    "lunch",
  ]);
  await page.goto("/nutrition/templates?meal=dinner");
  await page
    .getByRole("link", { name: `Edit ${riceName}`, exact: true })
    .click();
  await page.getByRole("checkbox", { name: "Dinner", exact: true }).uncheck();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/meal=dinner$/);
  await expect(
    page.getByRole("heading", { name: riceName, exact: true }),
  ).toHaveCount(0);
  expect(
    (
      await pool.query(
        "select to_jsonb(l) as record from meal_logs l where meal_template_id=$1 order by meal_category",
        [rice],
      )
    ).rows,
  ).toEqual(logs);
  await page.setViewportSize({ width: 320, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("creating from a filter requires explicit assignments and returns to that filter", async ({
  page,
  fixture,
}) => {
  const name = `New assigned meal ${randomUUID()}`;
  try {
    await page.goto("/nutrition/templates?meal=dinner");
    await page
      .getByRole("link", { name: "Create template", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Add Ingredient (N)", exact: true })
      .click();
    const picker = page.getByRole("dialog");
    await picker.getByPlaceholder("Search ingredients...").fill(fixture.food);
    await picker
      .getByRole("button", { name: new RegExp(`^${fixture.food}`) })
      .click();
    await page
      .getByRole("button", { name: "Save Template", exact: true })
      .click();
    const dialog = page.getByRole("alertdialog");
    await dialog
      .getByRole("textbox", { name: "Template Name", exact: true })
      .fill(name);
    await expect(
      dialog.getByRole("checkbox", { name: "Dinner", exact: true }),
    ).not.toBeChecked();
    await expect(
      dialog.getByRole("button", { name: "Save Template", exact: true }),
    ).toBeDisabled();
    await dialog.getByRole("checkbox", { name: "Lunch", exact: true }).check();
    await dialog.getByRole("checkbox", { name: "Dinner", exact: true }).check();
    await dialog
      .getByRole("button", { name: "Save Template", exact: true })
      .click();
    await expect(page).toHaveURL(/\/nutrition\/templates\?meal=dinner$/);
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Create template", exact: true })
      .click();
    await page.getByRole("link", { name: "Back", exact: true }).click();
    await expect(page).toHaveURL(/meal=dinner$/);
  } finally {
    await fixture.pool.query(
      "delete from meal_template_ingredients where meal_template_id in (select id from meal_templates where name=$1)",
      [name],
    );
    await fixture.pool.query("delete from meal_templates where name=$1", [
      name,
    ]);
  }
});

test("a rejected save retains inputs and consecutive saves do not consume stale success", async ({
  page,
  fixture,
}) => {
  const names = [randomUUID(), randomUUID()].map((id) => `Retry meal ${id}`);
  try {
    await page.goto("/nutrition/meal-builder");
    await page
      .getByRole("button", { name: "Add Ingredient (N)", exact: true })
      .click();
    const picker = page.getByRole("dialog");
    await picker.getByPlaceholder("Search ingredients...").fill(fixture.food);
    await picker
      .getByRole("button", { name: new RegExp(`^${fixture.food}`) })
      .click();
    await page
      .getByRole("button", { name: "Save Template", exact: true })
      .click();
    const dialog = page.getByRole("alertdialog");
    await dialog
      .getByRole("textbox", { name: "Template Name", exact: true })
      .fill(names[0]);
    await dialog.getByRole("checkbox", { name: "Lunch", exact: true }).check();
    // Send invalid boundary input to the real action once, then retry normally.
    let rejected = false;
    await page.route("**/nutrition/meal-builder.data*", async (route) => {
      const request = route.request();
      const body = new URLSearchParams(request.postData() ?? "");
      if (
        !rejected &&
        request.method() === "POST" &&
        body.get("intent") === "save-template"
      ) {
        rejected = true;
        body.set("categories", "[]");
        await route.continue({ postData: body.toString() });
      } else await route.continue();
    });
    await dialog
      .getByRole("button", { name: "Save Template", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    expect(rejected).toBe(true);
    await expect(
      dialog.getByRole("textbox", { name: "Template Name", exact: true }),
    ).toHaveValue(names[0]);
    await expect(
      dialog.getByRole("checkbox", { name: "Lunch", exact: true }),
    ).toBeChecked();
    await dialog
      .getByRole("button", { name: "Save Template", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await page
      .getByRole("button", { name: "Save Template", exact: true })
      .click();
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole("textbox", { name: "Template Name", exact: true })
      .fill(names[1]);
    await dialog.getByRole("checkbox", { name: "Dinner", exact: true }).check();
    await dialog
      .getByRole("button", { name: "Save Template", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect
      .poll(
        async () =>
          (
            await fixture.pool.query(
              "select name from meal_templates where name = any($1::text[])",
              [names],
            )
          ).rowCount,
      )
      .toBe(2);
  } finally {
    await fixture.pool.query(
      "delete from meal_template_ingredients where meal_template_id in (select id from meal_templates where name = any($1::text[]))",
      [names],
    );
    await fixture.pool.query(
      "delete from meal_templates where name = any($1::text[])",
      [names],
    );
  }
});
