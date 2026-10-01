import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import pg from "pg";
import {
  canWriteFixtureDatabase,
  fixtureOwnerId,
  verifyFixtureServerDatabase,
} from "./support/fixture-database";

test.skip(
  !canWriteFixtureDatabase(process.env.E2E_DATABASE_URL),
  "Requires matching dedicated fixture database and server",
);
test.use({ viewport: { width: 390, height: 844 } });
test("private nutrition routes, compositions and AI resolution stay account-scoped while explicit public links work", async ({
  page,
  request,
  browser,
  baseURL,
}) => {
  const pool = new pg.Pool({ connectionString: process.env.E2E_DATABASE_URL });
  const other = randomUUID();
  const food = randomUUID();
  const template = randomUUID();
  const meal = randomUUID();
  const name = `Private nutrition ${randomUUID()}`;
  const note = `Private nutrition note ${randomUUID()}`;
  const createdFoods: string[] = [];
  const records = async () =>
    (
      await pool.query(
        "select to_jsonb(i) as food,to_jsonb(t) as template,to_jsonb(m) as meal,to_jsonb(ti) as template_ingredient,to_jsonb(mi) as meal_ingredient from ingredients i join meal_template_ingredients ti on ti.ingredient_id=i.id join meal_templates t on t.id=ti.meal_template_id join meal_logs m on m.meal_template_id=t.id join meal_log_ingredients mi on mi.meal_log_id=m.id where i.id=$1",
        [food],
      )
    ).rows;
  try {
    await verifyFixtureServerDatabase(request, pool);
    await pool.query(
      "insert into auth_users (id,name,email) values ($1,'Other nutrition fixture',$2)",
      [other, `${other}@example.invalid`],
    );
    await pool.query(
      "insert into ingredients (user_id,id,name,category,calories,protein,carbs,fat,fiber,water_percentage,energy_density,texture,slider_min,slider_max) values ($1,$2,$3,'proteins',100,20,5,2,1,70,1,'firm_solid',5,500)",
      [other, food, name],
    );
    await pool.query(
      "insert into meal_templates (user_id,id,name,categories,notes,total_calories,total_protein,total_carbs,total_fat,total_fiber,satiety_score) values ($1,$2,$3,array['lunch']::meal_category[],$4,100,20,5,2,1,3)",
      [other, template, name, note],
    );
    await pool.query(
      "insert into meal_logs (user_id,id,meal_category,logged_date,notes,meal_template_id) values ($1,$2,'lunch','1904-01-01',$3,$4)",
      [other, meal, note, template],
    );
    await pool.query(
      "insert into meal_template_ingredients (user_id,meal_template_id,ingredient_id,quantity_grams) values ($1,$2,$3,100)",
      [other, template, food],
    );
    await pool.query(
      "insert into meal_log_ingredients (user_id,meal_log_id,ingredient_id,quantity_grams) values ($1,$2,$3,200)",
      [other, meal, food],
    );
    const before = await records();
    for (const path of [
      "/nutrition?date=1904-01-01",
      "/nutrition/templates",
      "/nutrition/meal-builder",
    ]) {
      await page.goto(path);
      await expect(page.getByText(name, { exact: true })).toHaveCount(0);
      await expect(page.getByText(note, { exact: true })).toHaveCount(0);
    }
    for (const path of [
      `/nutrition/templates?edit=${template}`,
      `/nutrition/meal-builder?mealId=${meal}`,
      `/share/meal/${template}`,
    ]) {
      const response = await request.get(path);
      expect(response.status()).toBe(404);
      expect(await response.text()).not.toContain(note);
    }
    const forms: readonly Readonly<Record<string, string>>[] = [
      { intent: "delete-meal", mealId: meal },
      {
        intent: "apply-template",
        templateId: template,
        mealCategory: "lunch",
        loggedDate: "1904-01-02",
      },
      {
        intent: "toggle-template-public",
        templateId: template,
        isPublic: "true",
      },
      {
        intent: "save-as-template",
        mealId: meal,
        name: "Forged copy",
        categories: JSON.stringify(["lunch"]),
      },
    ];
    for (const form of forms) {
      const response = await request.post("/nutrition", { form });
      expect(response.status()).toBe(200);
      expect(await response.text()).not.toContain(note);
      expect(await records()).toEqual(before);
    }
    const edit = await request.post("/nutrition/templates", {
      form: {
        id: template,
        name: "Forged edit",
        mealTimes: "lunch",
        notes: "Forged",
        meal: "all",
      },
    });
    expect(edit.status()).toBe(404);
    const foreignIngredient = await request.post("/nutrition/meal-builder", {
      form: {
        intent: "save-meal",
        mode: "create",
        mealCategory: "lunch",
        loggedDate: "1904-01-02",
        ingredients: JSON.stringify([{ id: food, quantity: 100 }]),
      },
    });
    expect(foreignIngredient.status()).toBe(400);
    expect(await records()).toEqual(before);
    const resolved = await request.post("/api/nutrition/estimate-meal", {
      form: {
        intent: "resolve",
        mealCategory: "lunch",
        items: JSON.stringify([
          {
            name,
            estimatedGrams: 100,
            category: "proteins",
            texture: "firm_solid",
            calories: 100,
            protein: 20,
            carbs: 5,
            fat: 2,
            fiber: 1,
            waterPercentage: 70,
            energyDensity: 1,
            isVegetarian: false,
            isVegan: false,
          },
        ]),
      },
    });
    expect(resolved.ok()).toBe(true);
    createdFoods.push(
      ...(
        await pool.query(
          "select id from ingredients where user_id=$1 and name=$2",
          [fixtureOwnerId(), name],
        )
      ).rows.map((row) => row.id),
    );
    expect(createdFoods).toHaveLength(1);
    expect(createdFoods[0]).not.toBe(food);
    const forgedMeal = await request.post("/nutrition/meal-builder", {
      form: {
        intent: "save-meal",
        mode: "update",
        mealId: meal,
        ingredients: JSON.stringify([{ id: createdFoods[0], quantity: 999 }]),
      },
    });
    expect(forgedMeal.status()).toBe(404);
    const forgedTemplate = await request.post("/nutrition/meal-builder", {
      form: {
        intent: "save-template",
        name: "Forged ingredient association",
        categories: JSON.stringify(["lunch"]),
        ingredients: JSON.stringify([{ id: food, quantity: 100 }]),
      },
    });
    expect(forgedTemplate.status()).toBe(400);

    expect(await records()).toEqual(before);
    await pool.query("update meal_templates set is_public=true where id=$1", [
      template,
    ]);
    const anonymous = await browser.newContext();
    try {
      const shared = await anonymous.request.get(
        new URL(`/share/meal/${template}`, baseURL).toString(),
      );
      expect(shared.ok()).toBe(true);
      expect(await shared.text()).toContain(note);
      await pool.query(
        "update meal_templates set is_public=false where id=$1",
        [template],
      );
      expect(
        (
          await anonymous.request.get(
            new URL(`/share/meal/${template}`, baseURL).toString(),
          )
        ).status(),
      ).toBe(404);
    } finally {
      await anonymous.close();
    }
  } finally {
    await pool.query("delete from meal_log_ingredients where meal_log_id=$1", [
      meal,
    ]);
    await pool.query("delete from meal_logs where id=$1", [meal]);
    await pool.query(
      "delete from meal_template_ingredients where meal_template_id=$1",
      [template],
    );
    await pool.query("delete from meal_templates where id=$1", [template]);
    await pool.query("delete from ingredients where id=any($1::uuid[])", [
      [food, ...createdFoods],
    ]);
    await pool.query("delete from auth_users where id=$1", [other]);
    await pool.end();
  }
});
